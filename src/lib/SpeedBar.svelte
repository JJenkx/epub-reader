<script lang="ts">
	import { reader } from './reader.svelte';
	import { settings } from './settings.svelte';

	let { onpress, onpause }: { onpress?: () => void; onpause?: () => void } = $props();

	let pointer: number | null = $state(null);
	let spaceHeld = $state(false);

	const min = $derived(settings.values.minWpm);
	const max = $derived(settings.values.maxWpm);
	const mid = $derived(Math.round((min + max) / 20) * 10);
	const fraction = $derived(Math.min(1, Math.max(0, (reader.wpm - min) / (max - min))));
	const active = $derived(pointer !== null || spaceHeld);

	function wpmAt(e: PointerEvent & { currentTarget: HTMLDivElement }) {
		const rect = e.currentTarget.getBoundingClientRect();
		const f = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
		return Math.round((min + f * (max - min)) / 10) * 10;
	}

	/** On desktop, holding Space reads at the last speed (and a quick re-press rewinds). */
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
	aria-label="Hold to read; position sets words per minute"
	aria-valuemin={min}
	aria-valuemax={max}
	aria-valuenow={reader.wpm}
	onpointerdown={down}
	onpointermove={move}
	onpointerup={up}
	onpointercancel={up}
	oncontextmenu={(e) => e.preventDefault()}
>
	<div class="track">
		<div class="fill" style:width="{fraction * 100}%"></div>
		<div class="thumb" style:left="{fraction * 100}%">
			<span class="bubble">
				{Math.round(reader.rate)}
				{#if reader.catchUpUntil !== null}<small>↺</small>{/if}
			</span>
		</div>
	</div>
	<div class="labels">
		<span>{min}</span>
		<span>{mid}</span>
		<span>{max} wpm</span>
	</div>
</div>

<style>
	.bar {
		position: relative;
		max-width: 760px;
		margin: 0 auto;
		padding: 34px 20px 10px;
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

	.fill {
		position: absolute;
		inset: 0 auto 0 0;
		border-radius: 22px;
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

	.bubble {
		position: absolute;
		bottom: calc(100% + 12px);
		left: 50%;
		transform: translateX(-50%);
		padding: 2px 8px;
		border-radius: 6px;
		font-size: 0.85rem;
		font-variant-numeric: tabular-nums;
		white-space: nowrap;
		color: var(--muted);
	}

	.active .bubble {
		color: var(--accent);
		font-weight: 600;
	}

	.labels {
		display: flex;
		justify-content: space-between;
		margin-top: 6px;
		font-size: 0.72rem;
		color: var(--muted);
		font-variant-numeric: tabular-nums;
	}
</style>
