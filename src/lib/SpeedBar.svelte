<script lang="ts">
	import { reader } from './reader.svelte';
	import { settings } from './settings.svelte';

	let { onpress, onpause }: { onpress?: () => void; onpause?: () => void } = $props();

	let pointer: number | null = $state(null);
	let spaceHeld = $state(false);
	let hovering = $state(false);

	const min = $derived(settings.values.minWpm);
	const max = $derived(settings.values.maxWpm);
	const fraction = $derived(Math.min(1, Math.max(0, (reader.wpm - min) / (max - min))));
	const active = $derived(pointer !== null || spaceHeld);
	const actual = $derived(reader.actualWpm === null ? null : Math.round(reader.actualWpm));
	const actualFraction = $derived(
		actual === null ? 0 : Math.min(1, Math.max(0, (actual - min) / (max - min)))
	);

	function wpmAt(e: PointerEvent & { currentTarget: HTMLDivElement }) {
		const rect = e.currentTarget.getBoundingClientRect();
		const f = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
		return Math.round((min + f * (max - min)) / 10) * 10;
	}

	/** On desktop, holding Space reads at the last speed. */
	function isTyping(e: KeyboardEvent) {
		return e.target instanceof HTMLElement && e.target.closest('input, textarea, select, button, [contenteditable]');
	}

	function keydown(e: KeyboardEvent) {
		if (e.code !== 'Space' || isTyping(e) || !reader.book) return;
		e.preventDefault();
		if (e.repeat || spaceHeld || pointer !== null || reader.continuous) return;
		spaceHeld = true;
		onpress?.();
		reader.press(Math.min(max, Math.max(min, reader.wpm)));
	}

	function keyup(e: KeyboardEvent) {
		if (e.code === 'Space') stopSpace();
	}

	function stopSpace() {
		if (!spaceHeld) return;
		spaceHeld = false;
		if (reader.release()) onpause?.();
	}

	function down(e: PointerEvent & { currentTarget: HTMLDivElement }) {
		if (pointer !== null || !reader.book) return;
		e.preventDefault();
		pointer = e.pointerId;
		e.currentTarget.setPointerCapture(e.pointerId);
		onpress?.();
		reader.press(wpmAt(e));
	}

	function move(e: PointerEvent & { currentTarget: HTMLDivElement }) {
		if (e.pointerId === pointer) reader.wpm = wpmAt(e);
	}

	function up(e: PointerEvent) {
		if (e.pointerId !== pointer) return;
		pointer = null;
		if (reader.release()) onpause?.();
	}
</script>

<svelte:window onkeydown={keydown} onkeyup={keyup} onblur={stopSpace} />

<div
	class={['bar', { active }]}
	role="slider"
	tabindex="-1"
	aria-label="Hold to read; position sets the base words per minute"
	aria-valuemin={min}
	aria-valuemax={max}
	aria-valuenow={reader.wpm}
	aria-valuetext="up to {reader.wpm} words per minute"
	onpointerdown={down}
	onpointermove={move}
	onpointerup={up}
	onpointercancel={up}
	onpointerenter={(e) => (hovering = e.pointerType === 'mouse')}
	onpointerleave={() => (hovering = false)}
	oncontextmenu={(e) => e.preventDefault()}
>
	<div class="track">
		<div class="fill" style:width="{fraction * 100}%"></div>
		<svg class="end turtle" viewBox="0 0 24 24" aria-hidden="true">
			<path d="M4.5 15.5c0-3.9 3-7 6.75-7S18 11.6 18 15.5zM18 13.2h1.6a2 2 0 0 0 0-4H18.6M7 15.5l-.7 2.2M15.5 15.5l.7 2.2M4.5 15.5H3M6 12.6h10.5" />
		</svg>
		<svg class="end rabbit" viewBox="0 0 24 24" aria-hidden="true">
			<path d="M15 9.5c-.6-2.7-.4-5.3.6-6 1-.6 2.3 1.6 2.2 5M17.8 8.5c.9-2.2 2.4-3.6 3.2-3 .7.6-.3 2.8-2 4.4M19 9.9c1.6.6 2.3 2 1.8 3.3-.5 1.1-1.9 1.4-3.3 1.2L15.8 18H10c-3.5 0-6-2.2-6-4.8S6.5 8.6 10 8.6c2.5 0 4.1.4 5 .9M4 13.2H2.6M10 18l-.5-2.3" />
		</svg>
		{#if actual !== null}
			<div class={['actual', { flip: actualFraction > 0.75 }]} style:left="{actualFraction * 100}%">
				<span>{actual}</span>
			</div>
		{/if}
		<div class="thumb" style:left="{fraction * 100}%">
			{#if active || hovering}
				<span class="bubble">up to {reader.wpm} wpm</span>
			{/if}
		</div>
	</div>
</div>

<style>
	.bar {
		position: relative;
		max-width: 760px;
		margin: 0 auto;
		padding: 8px 20px 6px;
		touch-action: none;
		user-select: none;
		-webkit-user-select: none;
		-webkit-touch-callout: none;
		cursor: pointer;
	}

	.track {
		position: relative;
		height: 44px;
		border-radius: 22px;
		background: var(--track);
		overflow: visible;
	}

	/* Square on the right so the fill meets the marker instead of rounding off beside it. */
	.fill {
		position: absolute;
		inset: 0 auto 0 0;
		border-radius: 22px 0 0 22px;
		background: var(--track-fill);
		transition: width 60ms linear;
	}

	.active .fill {
		background: var(--accent-soft);
	}

	.thumb {
		position: absolute;
		top: 50%;
		width: 4px;
		height: 32px;
		margin-left: -2px;
		transform: translateY(-50%);
		border-radius: 2px;
		background: var(--muted);
		pointer-events: none;
	}

	.active .thumb {
		background: var(--accent);
	}

	/* Floats over the text above, so it costs no space. */
	.bubble {
		position: absolute;
		bottom: calc(100% + 14px);
		left: 50%;
		transform: translateX(-50%);
		padding: 4px 10px;
		border-radius: 8px;
		background: var(--surface);
		box-shadow: 0 2px 10px rgb(0 0 0 / 0.18);
		font-size: 0.85rem;
		font-variant-numeric: tabular-nums;
		white-space: nowrap;
		color: var(--muted);
	}

	.active .bubble {
		color: var(--accent);
		font-weight: 600;
	}

	.end {
		position: absolute;
		top: 50%;
		width: 22px;
		height: 22px;
		transform: translateY(-50%);
		fill: none;
		stroke: var(--muted);
		stroke-width: 1.5;
		stroke-linecap: round;
		stroke-linejoin: round;
		opacity: 0.55;
		pointer-events: none;
	}

	.turtle {
		left: 12px;
	}

	.rabbit {
		right: 12px;
	}

	/* The speed actually read over the last minute: a faint tick with its value. */
	.actual {
		position: absolute;
		top: 7px;
		bottom: 7px;
		width: 0;
		border-left: 1.5px dashed var(--muted);
		opacity: 0.45;
		pointer-events: none;
	}

	.actual span {
		position: absolute;
		top: 50%;
		left: 5px;
		transform: translateY(-50%);
		font-size: 0.7rem;
		font-variant-numeric: tabular-nums;
		color: var(--text);
	}

	.actual.flip span {
		right: 5px;
		left: auto;
	}
</style>
