import { getEntry, putEntry, type DictionaryEntry } from './storage';

const API = 'https://en.wiktionary.org/api/rest_v1/page/definition/';

/** Strip surrounding punctuation and a possessive, and lowercase: "Alice’s," -> "alice". */
export function cleanWord(raw: string) {
	return raw
		.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '')
		.replace(/['’]s$/u, '')
		.toLowerCase();
}

/** Wiktionary's response: definitions per language, as HTML. */
type ApiResponse = Record<
	string,
	{ partOfSpeech: string; definitions: { definition: string }[] }[]
>;

export class NotFound extends Error {}

const toText = (html: string) =>
	(new DOMParser().parseFromString(html, 'text/html').body.textContent ?? '').replace(/\s+/g, ' ').trim();

async function fetchEnglish(word: string) {
	const res = await fetch(API + encodeURIComponent(word));
	if (res.status === 404) return null;
	if (!res.ok) throw new Error(`The dictionary service returned an error (${res.status}).`);
	const data = (await res.json()) as ApiResponse;
	return data.en?.length ? data.en : null;
}

/** A saved definition if there is one, otherwise fetch it from Wiktionary and save it. */
export async function lookup(word: string, context?: { sentence: string; book: string }) {
	const cached = await getEntry(word);
	if (cached) return cached;

	// Wiktionary is case-sensitive: try "word", then "Word" for names.
	const sections =
		(await fetchEnglish(word)) ?? (await fetchEnglish(word[0].toUpperCase() + word.slice(1)));
	if (!sections) throw new NotFound(`No definition found for “${word}”.`);

	const meanings = new Map<string, string[]>();
	for (const section of sections) {
		const list = meanings.get(section.partOfSpeech) ?? [];
		list.push(...section.definitions.map((d) => toText(d.definition)).filter(Boolean));
		if (list.length) meanings.set(section.partOfSpeech, list);
	}
	if (!meanings.size) throw new NotFound(`No definition found for “${word}”.`);

	const entry: DictionaryEntry = {
		word,
		meanings: [...meanings].map(([partOfSpeech, definitions]) => ({
			partOfSpeech,
			definitions: definitions.slice(0, 4)
		})),
		context: context?.sentence,
		book: context?.book,
		added: Date.now()
	};
	await putEntry(entry);
	return entry;
}

const escape = (s: string) =>
	s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/[\t\r\n]+/g, ' ');

/**
 * An Anki import file: tab-separated notes with header lines that tell Anki (2.1.55+) the
 * deck, note type and columns, so importing it creates the deck directly.
 */
export function ankiExport(entries: DictionaryEntry[]) {
	const lines = [
		'#separator:tab',
		'#html:true',
		'#notetype:Basic',
		'#deck:EPUB Reader',
		'#columns:Front\tBack'
	];
	for (const e of entries) {
		const front = escape(e.word);
		let back = e.phonetic ? `<i>${escape(e.phonetic)}</i><br>` : '';
		back += e.meanings
			.map(
				(m) =>
					`<b>${escape(m.partOfSpeech)}</b><ol>${m.definitions.map((d) => `<li>${escape(d)}</li>`).join('')}</ol>`
			)
			.join('');
		if (e.context) {
			back += `<hr><small>“${escape(e.context)}”${e.book ? ` — ${escape(e.book)}` : ''}</small>`;
		}
		lines.push(`${front}\t${back}`);
	}
	return new Blob([lines.join('\n') + '\n'], { type: 'text/plain;charset=utf-8' });
}
