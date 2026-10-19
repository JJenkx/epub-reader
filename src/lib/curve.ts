/** Word lengths the curve covers; longer words use the last value. */
export const CURVE_MAX_LETTERS = 20;
export const CURVE_MAX_MULTIPLIER = 3;

export interface Point {
	x: number;
	y: number;
}

export type Curve = [Point, Point, Point, Point];

/**
 * A cubic Bézier from the fixed origin (1, 1) to (20, y3), with two free control points.
 * Keeping 1 ≤ x1 ≤ x2 ≤ 20 makes x only ever increase along the curve, so it's a proper
 * function of word length.
 */
export function controlPoints(x1: number, y1: number, x2: number, y2: number, y3: number): Curve {
	return [
		{ x: 1, y: 1 },
		{ x: x1, y: y1 },
		{ x: x2, y: y2 },
		{ x: CURVE_MAX_LETTERS, y: y3 }
	];
}

function at(p0: number, p1: number, p2: number, p3: number, t: number) {
	const u = 1 - t;
	return u * u * u * p0 + 3 * u * u * t * p1 + 3 * u * t * t * p2 + t * t * t * p3;
}

/** Sample the curve at each whole length: `[[1, m1], [2, m2], … [20, m20]]`. */
export function curveTable([p0, p1, p2, p3]: Curve): [number, number][] {
	const table: [number, number][] = [];
	for (let length = 1; length <= CURVE_MAX_LETTERS; length++) {
		// x(t) is monotonic, so bisect for the t where x(t) = length.
		let lo = 0;
		let hi = 1;
		for (let i = 0; i < 40; i++) {
			const mid = (lo + hi) / 2;
			if (at(p0.x, p1.x, p2.x, p3.x, mid) < length) lo = mid;
			else hi = mid;
		}
		table.push([length, at(p0.y, p1.y, p2.y, p3.y, (lo + hi) / 2)]);
	}
	return table;
}
