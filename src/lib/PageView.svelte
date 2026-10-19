<script lang="ts">
	import { reader } from './reader.svelte';
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
		const token = reader.book?.tokens[index];
		const span = token && 'w' in token && token.s !== undefined ? token.s : index;
		const el = content.querySelector(`[data-w="${span}"]`);
		if (!el) return;
		el.classList.add('current');
		if (index === scrolledTo) return;
		const box = el.getBoundingClientRect();
		const view = scroller.getBoundingClientRect();
		if (box.bottom < view.top || box.top > view.bottom) {
			el.scrollIntoView({ block: index === chapters[chapter].start ? 'end' : 'center' });
		}
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
	<div class="page" style:--scale={settings.values.fontScale} {@attach sync} {onclick}>
		<!-- Safe: epub.ts strips scripts, handlers and all attributes but id/colspan/rowspan. -->
		{@html html}
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
