<script lang="ts">
	import { reader } from './reader.svelte';
	import { settings } from './settings.svelte';

	/**
	 * Lay a word out in three columns around the center. With the focus letter on, the
	 * center column is the word's optimal recognition point; otherwise it's the whole word.
	 * Optionally, a hyphenated word's other parts sit dimmed on either side.
	 */
	function split(w: string, focus: boolean) {
		if (!focus) return { before: '', pivot: w, after: '' };
		const letters = w.replace(/^[^\p{L}\p{N}]+/u, '');
		const lead = w.length - letters.length;
		const n = letters.replace(/[^\p{L}\p{N}]+$/u, '').length;
		const pivot = lead + (n <= 1 ? 0 : n <= 5 ? 1 : n <= 9 ? 2 : n <= 13 ? 3 : 4);
		return { before: w.slice(0, pivot), pivot: w[pivot] ?? '', after: w.slice(pivot + 1) };
	}

	/** Characters needed on the wider side of center, as a multiple of one character width. */
	function halfWidth(before: number, pivot: number, after: number) {
		return Math.max(before + pivot / 2, after + pivot / 2);
	}

	const parts = $derived.by(() => {
		const token = reader.token;
		if (!token || 'img' in token) return null;
		const focus = settings.values.focusLetter;
		// Without hyphen context, each part of a hyphenated word is just a word of its own.
		const h = settings.values.hyphenContext ? token.h : undefined;
		const all = h?.parts ?? [token.w];
		const at = h?.i ?? 0;
		// Size by the widest layout across all of a hyphenated word's parts, so the whole
		// word stays on screen and the size doesn't change between its parts.
		let half = 0;
		for (let i = 0; i < all.length; i++) {
			const p = split(all[i], focus);
			const dimBefore = all.slice(0, i).join('').length;
			const dimAfter = all.slice(i + 1).join('').length;
			half = Math.max(half, halfWidth(dimBefore + p.before.length, p.pivot.length, p.after.length + dimAfter));
		}
		return {
			dimBefore: all.slice(0, at).join(''),
			...split(token.w, focus),
			dimAfter: all.slice(at + 1).join(''),
			half
		};
	});
</script>

<div class="stage" style:--scale={settings.values.fontScale}>
	{#if reader.token && 'img' in reader.token}
		<img class="picture" src={reader.token.img} alt="" />
	{:else if parts}
		<div class={["guide", "top", { hidden: !settings.values.focusLetter }]}></div>
		<div class={['word', { plain: !settings.values.focusLetter }]} style:--half={parts.half}>
			<span class="before"><span class="dim">{parts.dimBefore}</span>{parts.before}</span><span
				class="pivot">{parts.pivot}</span
			><span class="after">{parts.after}<span class="dim">{parts.dimAfter}</span></span>
		</div>
		<div class={["guide", "bottom", { hidden: !settings.values.focusLetter }]}></div>
	{/if}
</div>

<style>
	.stage {
		position: relative;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		height: 100%;
		padding: 16px;
		overflow: hidden;
		user-select: none;
		-webkit-user-select: none;
	}

	.word {
		display: grid;
		grid-template-columns: 1fr auto 1fr;
		width: 100%;
		/* Shrink so the wider half of a long word still fits beside the fixed center. */
		font-size: min(
			calc(2.6rem * var(--scale)),
			calc((100vw - 32px) / (var(--half) * 2 * 0.62))
		);
		font-family: var(--word-font);
		line-height: 1.2;
		white-space: pre;
		color: var(--text);
	}

	/* Flex alignment lets dimmed neighbours overflow outward instead of pushing the center. */
	.before,
	.after {
		display: flex;
		min-width: 0;
	}

	.before {
		justify-content: flex-end;
	}

	.after {
		justify-content: flex-start;
	}

	.pivot {
		color: var(--accent);
	}

	.plain .pivot {
		color: inherit;
	}

	.dim {
		opacity: 0.5;
	}

	.guide {
		width: 2px;
		height: 14px;
		background: var(--guide);
	}

	.guide.hidden {
		visibility: hidden;
	}

	.top {
		margin-bottom: 10px;
	}

	.bottom {
		margin-top: 10px;
	}

	.picture {
		max-width: 100%;
		max-height: 100%;
		object-fit: contain;
		border-radius: 4px;
	}
</style>
