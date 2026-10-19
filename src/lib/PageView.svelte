<script lang="ts">
	import { reader } from './reader.svelte';
	import { scrub } from './scrub.svelte';
	import { settings } from './settings.svelte';

	let scrollTimer: ReturnType<typeof setTimeout> | undefined;

	const chapters = $derived(reader.book?.chapters ?? []);
	const chapter = $derived.by(() => {
		// Last chapter that starts at or before the current word.
		let lo = 0;
		let hi = chapters.length - 1;
		while (lo < hi) {
			const mid = (lo + hi + 1) >> 1;
			if (chapters[mid].start <= reader.index) lo = mid;
			else hi = mid - 1;
		}
		return lo;
	});
	const html = $derived(chapters[chapter]?.html ?? '');

	/** The trackpad highlight's box, in page coordinates. */
	let cursor = $state<{ x: number; y: number; w: number; h: number } | null>(null);

	/** How far the highlight stretches toward the next word, on each side. */
	const strain = $derived.by(() => {
		const { scrubStrainPx, scrubStrainCurve } = settings.values;
		const pull = (p: number) => scrubStrainPx * Math.min(1, Math.abs(p)) ** scrubStrainCurve;
		const x = pull(scrub.x);
		const y = pull(scrub.y);
		return {
			left: scrub.x < 0 ? x : 0,
			right: scrub.x > 0 ? x : 0,
			top: scrub.y < 0 ? y : 0,
			bottom: scrub.y > 0 ? y : 0
		};
	});
	const snapEase = $derived(`cubic-bezier(0.3, ${1 + settings.values.scrubSnapBounce}, 0.5, 1)`);

	let shownChapter = -1;
	/** The index the last scroll picked; following it must not scroll the page again. */
	let scrolledTo = -1;

	/** Keep the highlighted word in sync with the reader, scrolling only when it's off screen. */
	function sync(content: HTMLElement) {
		const index = reader.index;
		void html;
		const scroller = content.parentElement!;
		if (shownChapter !== chapter) {
			shownChapter = chapter;
			scroller.scrollTop = 0;
		}
		content.querySelector('.current')?.classList.remove('current');
		const el = wordAt(content, index);
		if (!el) return;
		el.classList.add('current');
		const box = el.getBoundingClientRect();
		const view = scroller.getBoundingClientRect();
		if (scrub.active) {
			const page = content.getBoundingClientRect();
			cursor = { x: box.left - page.left, y: box.top - page.top, w: box.width, h: box.height };
			// Keep the moving highlight comfortably on screen.
			const margin = Math.min(60, view.height / 4);
			if (box.top < view.top + margin || box.bottom > view.bottom - margin) {
				scroller.scrollTo({
					top: scroller.scrollTop + box.top - view.top - view.height / 2 + box.height / 2,
					behavior: 'smooth'
				});
			}
			return;
		}
		cursor = null;
		if (index === scrolledTo) return;
		if (box.bottom < view.top || box.top > view.bottom) {
			el.scrollIntoView({ block: index === chapters[chapter].start ? 'end' : 'center' });
		}
	}

	/** The element showing a token: the parts of a hyphenated word share one span. */
	function wordAt(content: HTMLElement, index: number) {
		const token = reader.book?.tokens[index];
		const span = token && 'w' in token && token.s !== undefined ? token.s : index;
		return content.querySelector<HTMLElement>(`[data-w="${span}"]`);
	}

	/** Let the trackpad move between lines while this page is showing. */
	function lines(content: HTMLElement) {
		scrub.lines = (index, dir, goalX) => {
			const from = wordAt(content, index);
			if (!from) return null;
			const words = [...content.querySelectorAll<HTMLElement>('[data-w]')];
			const at = words.indexOf(from);
			const here = from.getBoundingClientRect();
			const goal = goalX ?? here.left + here.width / 2 - content.getBoundingClientRect().left;
			const left = content.getBoundingClientRect().left;
			// Walk outward to the first word on another line, then along that line for the
			// word nearest the goal column.
			let line: DOMRect | null = null;
			let best: { el: HTMLElement; d: number } | null = null;
			for (let i = at + dir; i >= 0 && i < words.length; i += dir) {
				const box = words[i].getBoundingClientRect();
				if (!box.height) continue;
				const mid = box.top + box.height / 2;
				if (!line) {
					const off = dir > 0 ? mid > here.bottom : mid < here.top;
					if (!off) continue;
					line = box;
				} else if (mid < line.top || mid > line.bottom) {
					break;
				}
				const d = Math.abs(box.left + box.width / 2 - left - goal);
				if (!best || d < best.d) best = { el: words[i], d };
			}
			if (best) return { index: Number(best.el.dataset.w), x: goal };
			// Past the last line of the chapter: carry on into the next (or previous) one.
			const next = reader.wordStep(index, dir);
			return next === index ? null : { index: next, x: goal };
		};
		return () => {
			scrub.lines = null;
		};
	}

	function onclick(e: MouseEvent) {
		const el = (e.target as Element).closest('[data-w]');
		if (el instanceof HTMLElement) {
			scrolledTo = -1;
			reader.seek(Number(el.dataset.w));
		}
	}

	/** After scrolling settles, the first word visible at the top becomes the reading position. */
	function onscroll(e: Event & { currentTarget: HTMLDivElement }) {
		const scroller = e.currentTarget;
		const content = scroller.firstElementChild as HTMLElement;
		clearTimeout(scrollTimer);
		scrollTimer = setTimeout(() => {
			const words = content.querySelectorAll<HTMLElement>('[data-w]');
			const top = scroller.getBoundingClientRect().top;
			let lo = 0;
			let hi = words.length - 1;
			while (lo < hi) {
				const mid = (lo + hi) >> 1;
				if (words[mid].getBoundingClientRect().top < top) lo = mid + 1;
				else hi = mid;
			}
			const first = words[lo];
			if (!first) return;
			const index = Number(first.dataset.w);
			// Don't override a word the user tapped if it's still on screen.
			const current = content.querySelector('.current');
			const box = current?.getBoundingClientRect();
			if (box && box.top >= top && box.bottom <= scroller.getBoundingClientRect().bottom) return;
			scrolledTo = index;
			reader.seek(index, false);
		}, 250);
	}

	function go(delta: number) {
		const next = chapters[chapter + delta];
		if (next) reader.seek(next.start);
	}
</script>

<div class="scroller" {onscroll}>
	<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
	<div
		class={['page', { scrubbing: cursor }]}
		style:--scale={settings.values.fontScale}
		{@attach sync}
		{@attach lines}
		{onclick}
	>
		<!-- Safe: epub.ts strips scripts, handlers and all attributes but id/colspan/rowspan. -->
		{@html html}
		{#if cursor}
			<div
				class="cursor"
				style:transform="translate({cursor.x}px, {cursor.y}px)"
				style:width="{cursor.w}px"
				style:height="{cursor.h}px"
				style:transition-duration="{settings.values.scrubSnapMs}ms"
				style:transition-timing-function={snapEase}
			>
				<span
					style:left="{-strain.left - 2}px"
					style:right="{-strain.right - 2}px"
					style:top="{-strain.top - 2}px"
					style:bottom="{-strain.bottom - 2}px"
				></span>
			</div>
		{/if}
	</div>
	<nav class="chapters">
		<button disabled={chapter === 0} onclick={() => go(-1)}>← Previous</button>
		<span>{chapter + 1} / {chapters.length}</span>
		<button disabled={chapter >= chapters.length - 1} onclick={() => go(1)}>Next →</button>
	</nav>
</div>

<style>
	.scroller {
		height: 100%;
		overflow-y: auto;
		overscroll-behavior: contain;
		-webkit-overflow-scrolling: touch;
	}

	.page {
		position: relative;
		isolation: isolate;
		max-width: 38em;
		margin: 0 auto;
		padding: 16px 20px 24px;
		font-family: var(--page-font);
		font-size: calc(1.1rem * var(--scale));
		line-height: 1.6;
		color: var(--text);
		overflow-wrap: break-word;
	}

	.page :global {
		img {
			display: block;
			max-width: 100%;
			height: auto;
			margin: 1em auto;
		}

		h1,
		h2,
		h3 {
			line-height: 1.25;
		}

		[data-w] {
			cursor: pointer;
			border-radius: 3px;
		}

		.current {
			background: var(--highlight);
			box-shadow: 0 0 0 2px var(--highlight);
		}

		img.current {
			outline: 3px solid var(--accent);
			box-shadow: none;
		}

		table {
			border-collapse: collapse;
			max-width: 100%;
		}
	}

	/* While dragging, a separate highlight glides between words instead. */
	.page.scrubbing :global(.current) {
		background: none;
		box-shadow: none;
		outline: none;
	}

	/* The box snaps from word to word (transition on the outer box) while its inner fill
	   stretches toward the next word as the drag pulls (no transition, so it follows the finger). */
	.cursor {
		position: absolute;
		top: 0;
		left: 0;
		pointer-events: none;
		transition-property: transform, width, height;
		z-index: -1;
	}

	.cursor span {
		position: absolute;
		border-radius: 4px;
		background: var(--highlight);
	}

	.chapters {
		display: flex;
		align-items: center;
		justify-content: space-between;
		max-width: 38em;
		margin: 0 auto;
		padding: 8px 20px 32px;
		color: var(--muted);
		font-size: 0.85rem;
	}

	.chapters button {
		padding: 10px 14px;
		border: 1px solid var(--border);
		border-radius: 8px;
		background: none;
		color: var(--text);
		font: inherit;
	}

	.chapters button:disabled {
		opacity: 0.35;
	}
</style>
