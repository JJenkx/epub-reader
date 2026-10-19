import JSZip from 'jszip';

/** A whole word or image, before hyphenated words are split. `p` marks the end of a paragraph. */
type Word = { w: string; p?: true } | { img: string };

/**
 * A word to flash, or an image to hold on screen. Hyphenated words become one token per
 * part: `w` is the part, `h` the whole word's parts and which one this is, and `s` the
 * index of the first part (the one the page view's span points at).
 */
export type Token =
	| { w: string; p?: true; h?: { parts: string[]; i: number }; s?: number }
	| { img: string };

/** Whitespace, a spaced-out ellipsis (". . .") as one word, or any other run of non-space. */
const WORDS = /\s+|\.(?:[^\S\n]+\.)+[^\s.]*|\S+/g;

/**
 * Split after a run of hyphens or dashes (-, ‐, ‑, ‒, –, —, ―, "--") with text on both sides:
 * "well-known", "wood—(she", "Midnight.—The", "nail”—which", "wood--she".
 */
const DASHES = '\\-\\u2010-\\u2015';
const HYPHEN = new RegExp(`(?<=[^\\s${DASHES}][${DASHES}]+)(?=[^\\s${DASHES}])`, 'u');
const HAS_TEXT = /[\p{L}\p{N}]/u;

function expand(word: Word, index: number): Token[] {
	if ('img' in word) return [word];
	// Pieces with no letters ("think—" + "”") stay attached to their neighbour.
	const parts: string[] = [];
	for (const piece of word.w.split(HYPHEN)) {
		if (parts.length && (!HAS_TEXT.test(piece) || !HAS_TEXT.test(parts[parts.length - 1]))) {
			parts[parts.length - 1] += piece;
		} else {
			parts.push(piece);
		}
	}
	if (parts.length < 2) return [word];
	return parts.map((w, i) => ({
		w,
		h: { parts, i },
		s: index,
		...(word.p && i === parts.length - 1 ? { p: true as const } : {})
	}));
}

export interface Chapter {
	/** Index of the first token in this chapter. */
	start: number;
	/** Chapter body as HTML, with every word wrapped in `<span data-w="index">`. */
	html: string;
}

export interface TocItem {
	label: string;
	depth: number;
	index: number;
}

export interface Book {
	title: string;
	tokens: Token[];
	chapters: Chapter[];
	toc: TocItem[];
	dispose(): void;
}

const SKIP = new Set([
	'script',
	'style',
	'head',
	'noscript',
	'template',
	'iframe',
	'object',
	'embed',
	'link',
	'meta',
	'audio',
	'video',
	'form',
	'input',
	'button'
]);

const BLOCK = new Set([
	'p',
	'div',
	'section',
	'article',
	'aside',
	'header',
	'footer',
	'nav',
	'blockquote',
	'pre',
	'h1',
	'h2',
	'h3',
	'h4',
	'h5',
	'h6',
	'li',
	'ul',
	'ol',
	'dl',
	'dt',
	'dd',
	'table',
	'tr',
	'td',
	'th',
	'figure',
	'figcaption',
	'hr',
	'br'
]);

function resolve(base: string, href: string) {
	const url = new URL(href, 'http://x/' + base);
	return decodeURIComponent(url.pathname.slice(1)) + (url.hash ? decodeURIComponent(url.hash) : '');
}

function parseXml(text: string) {
	return new DOMParser().parseFromString(text, 'application/xml');
}

function byTag(root: ParentNode & { getElementsByTagNameNS: Document['getElementsByTagNameNS'] }, tag: string) {
	return Array.from(root.getElementsByTagNameNS('*', tag));
}

function parseChapterDoc(text: string, type: string) {
	if (type.includes('xhtml') || type.includes('xml')) {
		const doc = new DOMParser().parseFromString(text, 'application/xhtml+xml');
		if (!doc.getElementsByTagName('parsererror').length) return doc;
	}
	return new DOMParser().parseFromString(text, 'text/html');
}

export async function parseEpub(data: Blob): Promise<Book> {
	const zip = await JSZip.loadAsync(data);
	const read = async (path: string) => {
		const file = zip.file(path);
		if (!file) throw new Error(`Missing ${path} in EPUB`);
		return file.async('string');
	};

	const container = parseXml(await read('META-INF/container.xml'));
	const opfPath = byTag(container, 'rootfile')[0]?.getAttribute('full-path');
	if (!opfPath) throw new Error('Not a valid EPUB (no package file)');
	const opf = parseXml(await read(opfPath));

	const manifest = new Map<string, { href: string; type: string; props: string }>();
	for (const item of byTag(opf, 'item')) {
		manifest.set(item.getAttribute('id') ?? '', {
			href: resolve(opfPath, item.getAttribute('href') ?? ''),
			type: item.getAttribute('media-type') ?? '',
			props: item.getAttribute('properties') ?? ''
		});
	}

	// Every image becomes a blob URL up front, so the DOM walk can stay synchronous.
	const urls: string[] = [];
	const images = new Map<string, string>();
	await Promise.all(
		[...manifest.values()]
			.filter((m) => m.type.startsWith('image/'))
			.map(async (m) => {
				const file = zip.file(m.href);
				if (!file) return;
				const blob = new Blob([await file.async('arraybuffer')], { type: m.type });
				const url = URL.createObjectURL(blob);
				urls.push(url);
				images.set(m.href, url);
			})
	);

	const title = byTag(opf, 'title')[0]?.textContent?.trim() || 'Untitled';
	const tokens: Token[] = [];
	const chapters: Chapter[] = [];
	// Token index for each chapter path and each `path#id`, used to resolve TOC links.
	const anchors = new Map<string, number>();
	const htmlDoc = document.implementation.createHTMLDocument('');

	const spine = byTag(opf, 'itemref')
		.map((ref) => manifest.get(ref.getAttribute('idref') ?? ''))
		.filter((m) => m && (m.type.includes('html') || m.type.includes('xml')));

	for (const item of spine) {
		const { href: path, type } = item!;
		const file = zip.file(path);
		if (!file) continue;
		const src = parseChapterDoc(await file.async('string'), type);
		const body = src.body ?? byTag(src, 'body')[0];
		if (!body) continue;

		// Importing into an HTML document makes innerHTML serialize as HTML, not XHTML.
		const root = htmlDoc.importNode(body, true) as HTMLElement;
		// Walk into whole words first; hyphenated words are expanded into parts afterwards,
		// so data-w attributes and anchors hold word indexes until then.
		const words: Word[] = [];
		const localAnchors: [string, number][] = [[path, 0]];
		let glue = false;

		const breakParagraph = () => {
			const last = words[words.length - 1];
			if (last && 'w' in last) last.p = true;
			glue = false;
		};

		const pushImage = (el: Element, href: string | null) => {
			const url = href ? images.get(resolve(path, href)) : undefined;
			if (!url) {
				el.remove();
				return;
			}
			const img = htmlDoc.createElement('img');
			img.src = url;
			img.alt = el.getAttribute('alt') ?? '';
			img.dataset.w = String(words.length);
			el.replaceWith(img);
			breakParagraph();
			words.push({ img: url });
		};

		const walk = (node: Node) => {
			for (const child of Array.from(node.childNodes)) {
				if (child.nodeType === Node.TEXT_NODE) {
					text(child as Text);
				} else if (child.nodeType === Node.ELEMENT_NODE) {
					element(child as Element);
				} else {
					child.remove();
				}
			}
		};

		const element = (el: Element) => {
			const tag = el.localName.toLowerCase();
			if (SKIP.has(tag)) return el.remove();

			const id = el.getAttribute('id');
			if (id) localAnchors.push([`${path}#${id}`, words.length]);

			if (tag === 'img') return pushImage(el, el.getAttribute('src'));
			if (tag === 'svg') {
				const image = byTag(el, 'image')[0];
				if (image) {
					return pushImage(
						el,
						image.getAttribute('href') ?? image.getAttributeNS('http://www.w3.org/1999/xlink', 'href')
					);
				}
				return el.remove();
			}

			for (const attr of Array.from(el.attributes)) {
				if (attr.name !== 'id' && attr.name !== 'colspan' && attr.name !== 'rowspan') {
					el.removeAttribute(attr.name);
				}
			}

			const block = BLOCK.has(tag);
			if (block) breakParagraph();
			walk(el);
			if (block) breakParagraph();
		};

		const text = (node: Text) => {
			const value = node.data;
			if (!value.trim()) {
				if (value.length) glue = false;
				return;
			}
			const frag = htmlDoc.createDocumentFragment();
			let first = true;
			for (const [part] of value.matchAll(WORDS)) {
				if (/^\s/.test(part)) {
					frag.append(part);
					first = false;
					continue;
				}
				const span = htmlDoc.createElement('span');
				span.textContent = part;
				const last = words[words.length - 1];
				// Join "<b>T</b>he" style splits back into one word.
				if (first && glue && last && 'w' in last && !last.p) {
					last.w += part;
					span.dataset.w = String(words.length - 1);
				} else {
					span.dataset.w = String(words.length);
					words.push({ w: part });
				}
				frag.append(span);
				first = false;
			}
			glue = !/\s$/.test(value);
			node.replaceWith(frag);
		};

		walk(root);
		breakParagraph();
		if (!words.length) continue;

		const map = words.map((word) => {
			const index = tokens.length;
			tokens.push(...expand(word, index));
			return index;
		});
		for (const el of root.querySelectorAll<HTMLElement>('[data-w]')) {
			el.dataset.w = String(map[Number(el.dataset.w)]);
		}
		for (const [key, i] of localAnchors) anchors.set(key, map[i] ?? tokens.length - 1);
		chapters.push({ start: map[0], html: root.innerHTML });
	}

	if (!tokens.length) throw new Error('No readable text found in this EPUB');

	const toc = await parseToc(opf, manifest, read, anchors);

	return {
		title,
		tokens,
		chapters,
		toc,
		dispose: () => urls.forEach((u) => URL.revokeObjectURL(u))
	};
}

async function parseToc(
	opf: Document,
	manifest: Map<string, { href: string; type: string; props: string }>,
	read: (path: string) => Promise<string>,
	anchors: Map<string, number>
): Promise<TocItem[]> {
	const items: TocItem[] = [];
	const lookup = (target: string) => anchors.get(target) ?? anchors.get(target.split('#')[0]);

	const add = (label: string, base: string, href: string | null, depth: number) => {
		if (!href) return;
		const index = lookup(resolve(base, href));
		if (index !== undefined && label) items.push({ label, depth, index });
	};

	try {
		const nav = [...manifest.values()].find((m) => m.props.split(/\s+/).includes('nav'));
		if (nav) {
			const doc = parseChapterDoc(await read(nav.href), nav.type);
			const navs = byTag(doc, 'nav');
			const tocNav =
				navs.find((n) => (n.getAttributeNS('http://www.idpf.org/2007/ops', 'type') ?? n.getAttribute('epub:type')) === 'toc') ??
				navs[0];
			const list = tocNav && byTag(tocNav, 'ol')[0];
			const visit = (ol: Element, depth: number) => {
				for (const li of Array.from(ol.children)) {
					if (li.localName !== 'li') continue;
					const a = Array.from(li.children).find((c) => c.localName === 'a' || c.localName === 'span');
					if (a) add(a.textContent?.replace(/\s+/g, ' ').trim() ?? '', nav.href, a.getAttribute('href'), depth);
					const sub = Array.from(li.children).find((c) => c.localName === 'ol');
					if (sub) visit(sub, depth + 1);
				}
			};
			if (list) visit(list, 0);
		}

		if (!items.length) {
			const spine = byTag(opf, 'spine')[0];
			const ncx = manifest.get(spine?.getAttribute('toc') ?? '') ?? [...manifest.values()].find((m) => m.type === 'application/x-dtbncx+xml');
			if (ncx) {
				const doc = parseXml(await read(ncx.href));
				const visit = (parent: Element, depth: number) => {
					for (const point of Array.from(parent.children)) {
						if (point.localName !== 'navPoint') continue;
						const label = byTag(point, 'text')[0]?.textContent?.trim() ?? '';
						const content = Array.from(point.children).find((c) => c.localName === 'content');
						add(label, ncx.href, content?.getAttribute('src') ?? null, depth);
						visit(point, depth + 1);
					}
				};
				const navMap = byTag(doc, 'navMap')[0];
				if (navMap) visit(navMap, 0);
			}
		}
	} catch {
		// A broken TOC shouldn't stop the book from opening.
	}

	return items;
}
