<script lang="ts">
	import { CURVE_MAX_LETTERS, CURVE_MAX_MULTIPLIER } from './curve';
	import { settings } from './settings.svelte';

	// Plot area inside the SVG's coordinate space.
	const W = 320;
	const H = 220;
	const L = 46;
	const R = W - 12;
	const T = 12;
	const B = H - 30;

	const px = (x: number) => L + ((x - 1) / (CURVE_MAX_LETTERS - 1)) * (R - L);
	const py = (y: number) => B - ((y - 1) / (CURVE_MAX_MULTIPLIER - 1)) * (B - T);

	const yLines = Array.from({ length: (CURVE_MAX_MULTIPLIER - 1) / 0.5 + 1 }, (_, i) => 1 + i * 0.5);
	const xLines = Array.from({ length: CURVE_MAX_LETTERS }, (_, i) => i + 1);
	const xLabels = [1, 5, 10, 15, 20];

	type Handle = 0 | 1 | 2;
	let dragging = $state<Handle | null>(null);

	const v = $derived(settings.values);
	const points = $derived([
		{ x: 1, y: v.curveY0 },
		{ x: v.curveX1, y: v.curveY1 },
		{ x: CURVE_MAX_LETTERS, y: v.curveY2 }
	]);
	// Mapping to screen space is affine, so the SVG quadratic draws exactly the same curve.
	const path = $derived(
		`M ${px(points[0].x)} ${py(points[0].y)} Q ${px(points[1].x)} ${py(points[1].y)} ${px(points[2].x)} ${py(points[2].y)}`
	);

	function toData(svg: SVGSVGElement, e: PointerEvent) {
		const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(svg.getScreenCTM()!.inverse());
		const x = 1 + ((p.x - L) / (R - L)) * (CURVE_MAX_LETTERS - 1);
		const y = 1 + ((B - p.y) / (B - T)) * (CURVE_MAX_MULTIPLIER - 1);
		const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));
		return {
			x: Math.round(clamp(x, 1, CURVE_MAX_LETTERS) * 10) / 10,
			y: Math.round(clamp(y, 1, CURVE_MAX_MULTIPLIER) * 100) / 100
		};
	}

	function down(e: PointerEvent & { currentTarget: SVGGElement }, handle: Handle) {
		e.preventDefault();
		dragging = handle;
		// Capture on the <svg> so moves keep arriving there even off the handle.
		e.currentTarget.ownerSVGElement?.setPointerCapture(e.pointerId);
	}

	function move(e: PointerEvent & { currentTarget: SVGSVGElement }) {
		if (dragging === null) return;
		const { x, y } = toData(e.currentTarget, e);
		if (dragging === 0) settings.values.curveY0 = y;
		else if (dragging === 2) settings.values.curveY2 = y;
		else {
			settings.values.curveX1 = x;
			settings.values.curveY1 = y;
		}
	}

	const names = ['Start (1 letter)', 'Middle control point', 'End (20 letters)'];

	/** Arrow keys nudge a point: up/down for the multiplier, left/right for the middle point's length. */
	function keydown(e: KeyboardEvent, handle: Handle) {
		const v = settings.values;
		const dy = e.key === 'ArrowUp' ? 0.05 : e.key === 'ArrowDown' ? -0.05 : 0;
		const dx = handle === 1 ? (e.key === 'ArrowRight' ? 0.5 : e.key === 'ArrowLeft' ? -0.5 : 0) : 0;
		if (!dx && !dy) return;
		e.preventDefault();
		const y = (n: number) => Math.round(Math.min(CURVE_MAX_MULTIPLIER, Math.max(1, n + dy)) * 100) / 100;
		if (handle === 0) v.curveY0 = y(v.curveY0);
		else if (handle === 2) v.curveY2 = y(v.curveY2);
		else {
			v.curveY1 = y(v.curveY1);
			v.curveX1 = Math.min(CURVE_MAX_LETTERS, Math.max(1, v.curveX1 + dx));
		}
		settings.save();
	}

	function up() {
		if (dragging === null) return;
		dragging = null;
		settings.save();
	}
</script>

<svg
	viewBox="0 0 {W} {H}"
	role="application"
	aria-label="Display time multiplier by word length. Drag the three points to shape the curve."
	onpointermove={move}
	onpointerup={up}
	onpointercancel={up}
>
	{#each xLines as x (x)}
		<line class="grid faint" x1={px(x)} x2={px(x)} y1={T} y2={B} />
	{/each}
	{#each yLines as y (y)}
		<line class="grid" x1={L} x2={R} y1={py(y)} y2={py(y)} />
		<text class="label" x={L - 6} y={py(y) + 4} text-anchor="end">{y}×</text>
	{/each}
	{#each xLabels as x (x)}
		<text class="label" x={px(x)} y={B + 16} text-anchor="middle">{x}</text>
	{/each}
	<text class="label axis" x={(L + R) / 2} y={H - 1} text-anchor="middle">letters</text>

	<polyline
		class="hull"
		points={points.map((p) => `${px(p.x)},${py(p.y)}`).join(' ')}
	/>
	<path class="curve" d={path} />
	{#each settings.lengthTable as [length, m] (length)}
		<circle class="sample" cx={px(length)} cy={py(m)} r="2.2" />
	{/each}

	{#each points as p, i (i)}
		<g
			class={['handle', { active: dragging === i, free: i === 1 }]}
			role="slider"
			tabindex="0"
			aria-label={names[i]}
			aria-valuemin={1}
			aria-valuemax={CURVE_MAX_MULTIPLIER}
			aria-valuenow={p.y}
			aria-valuetext={i === 1 ? `${p.x} letters, ${p.y}×` : `${p.y}×`}
			onpointerdown={(e) => down(e, i as Handle)}
			onkeydown={(e) => keydown(e, i as Handle)}
		>
			<circle class="hit" cx={px(p.x)} cy={py(p.y)} r="20" />
			<circle class="dot" cx={px(p.x)} cy={py(p.y)} r="7" />
		</g>
	{/each}
</svg>
<p class="readout">
	{#if dragging === null}
		Drag the points. The ends move up and down; the middle one moves freely.
	{:else}
		{#if dragging === 1}{points[1].x.toFixed(1)} letters, {/if}{points[dragging].y.toFixed(2)}×
	{/if}
</p>

<style>
	svg {
		display: block;
		width: 100%;
		height: auto;
		touch-action: none;
		user-select: none;
		-webkit-user-select: none;
	}

	.grid {
		stroke: var(--border);
		stroke-width: 1;
	}

	.grid.faint {
		stroke-opacity: 0.45;
	}

	.label {
		fill: var(--muted);
		font-size: 10px;
		font-variant-numeric: tabular-nums;
	}

	.axis {
		font-size: 10px;
	}

	.hull {
		fill: none;
		stroke: var(--muted);
		stroke-width: 1;
		stroke-dasharray: 3 3;
	}

	.curve {
		fill: none;
		stroke: var(--accent);
		stroke-width: 2.5;
	}

	.sample {
		fill: var(--text);
	}

	.handle {
		cursor: grab;
		outline: none;
	}

	.handle:focus-visible .dot {
		stroke-width: 3.5;
	}

	.handle .hit {
		fill: transparent;
	}

	.handle .dot {
		fill: var(--surface);
		stroke: var(--text);
		stroke-width: 2;
	}

	.handle.free .dot {
		stroke: var(--accent);
	}

	.handle.active .dot {
		fill: var(--accent);
	}

	.readout {
		min-height: 1.3em;
		margin: 4px 0 0;
		font-size: 0.8rem;
		color: var(--muted);
		font-variant-numeric: tabular-nums;
	}
</style>
