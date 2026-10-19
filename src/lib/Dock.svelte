<script lang="ts">
	import { reader } from './reader.svelte';
	import { scrub } from './scrub.svelte';
	import { settings } from './settings.svelte';

	let {
		ontoggle,
		onscrubstart
	}: { ontoggle: () => void; onscrubstart: () => void } = $props();

	let pointer: number | null = null;
	let start = { x: 0, y: 0 };
	let last = { x: 0, y: 0 };
	/** A drag ended on this press, so the tap that follows isn't a play or rewind. */
	let swallowClick = false;

	function down(e: PointerEvent) {
		if (pointer !== null || !e.isPrimary) return;
		pointer = e.pointerId;
		start = last = { x: e.clientX, y: e.clientY };
		swallowClick = false;
	}

	function move(e: PointerEvent & { currentTarget: HTMLDivElement }) {
		if (e.pointerId !== pointer) return;
		if (!scrub.active) {
			if (Math.hypot(e.clientX - start.x, e.clientY - start.y) < settings.values.scrubStartPx) return;
			// It's a drag, not a tap: become a trackpad.
			e.currentTarget.setPointerCapture(e.pointerId);
			onscrubstart();
			scrub.begin();
		} else {
			scrub.move(e.clientX - last.x, e.clientY - last.y);
		}
		last = { x: e.clientX, y: e.clientY };
	}

	function up(e: PointerEvent) {
		if (e.pointerId !== pointer) return;
		pointer = null;
		if (scrub.active) {
			scrub.end();
			swallowClick = true;
		}
	}

	function clickcapture(e: MouseEvent) {
		if (!swallowClick) return;
		swallowClick = false;
		e.stopPropagation();
		e.preventDefault();
	}
</script>

<div
	class={['dock', { scrubbing: scrub.active }]}
	role="group"
	aria-label="Playback. Drag to move through the text."
	onpointerdown={down}
	onpointermove={move}
	onpointerup={up}
	onpointercancel={up}
	onclickcapture={clickcapture}
	oncontextmenu={(e) => e.preventDefault()}
>
	<button class="rewind" aria-label="Rewind" onclick={() => reader.back()}>
		<svg viewBox="0 0 24 24"><path d="M11 7.5v9a.8.8 0 0 1-1.3.6L4 12.6a.8.8 0 0 1 0-1.2l5.7-4.5a.8.8 0 0 1 1.3.6zM20 7.5v9a.8.8 0 0 1-1.3.6L13 12.6a.8.8 0 0 1 0-1.2l5.7-4.5a.8.8 0 0 1 1.3.6z" /></svg>
	</button>
	<button class="play" aria-label={reader.continuous ? 'Pause' : 'Play'} onclick={ontoggle}>
		{#if reader.continuous}
			<svg viewBox="0 0 24 24"><rect x="6" y="5" width="4" height="14" rx="1" /><rect x="14" y="5" width="4" height="14" rx="1" /></svg>
		{:else}
			<svg viewBox="0 0 24 24"><path d="M8 5.5v13a1 1 0 0 0 1.5.9l10.4-6.5a1 1 0 0 0 0-1.8L9.5 4.6A1 1 0 0 0 8 5.5z" /></svg>
		{/if}
	</button>
</div>

<style>
	/* Big, easy-to-hit controls: rewind on the left quarter, play/pause on the rest. On phones
	   they fill the bottom of the screen up to the speed bar. Dragging anywhere on them moves
	   through the text like a trackpad. */
	.dock {
		display: flex;
		gap: 8px;
		width: calc(100% - 24px);
		max-width: 800px;
		height: 64px;
		margin: 4px auto calc(12px + env(safe-area-inset-bottom));
		touch-action: none;
		user-select: none;
		-webkit-user-select: none;
		-webkit-touch-callout: none;
	}

	@media (pointer: coarse) {
		.dock {
			height: calc(25dvh + 36px - env(safe-area-inset-bottom));
			min-height: 120px;
		}
	}

	button {
		display: grid;
		place-items: center;
		padding: 0;
		border: 0;
		border-radius: 18px;
		background: var(--track);
		color: var(--muted);
		transition: opacity 150ms;
	}

	button:active {
		background: var(--track-fill);
	}

	/* While dragging the whole dock is one surface, so neither button looks pressed. */
	.scrubbing button {
		background: var(--track);
		opacity: 0.6;
	}

	.rewind {
		flex: 1;
	}

	.play {
		flex: 3;
	}

	svg {
		width: 40px;
		height: 40px;
		fill: currentColor;
	}

	.rewind svg {
		width: 32px;
		height: 32px;
	}
</style>
