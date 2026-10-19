/** Word lengths the curve covers; longer words use the last value. */
export const CURVE_MAX_LETTERS = 20;
export const CURVE_MAX_MULTIPLIER = 3;

export interface Point {
	x: number;
	y: number;
}

/**
 * A quadratic Bézier from (1, y0) to (20, y2) with one free control point. Because the end
 * points sit at the edges of the x range and the control point's x stays inside it, x only
 * ever increases along the curve, so it's a proper function of word length.
 */
export function controlPoints(y0: number, x1: number, y1: number, y2: number): [Point, Point, Point] {
	return [
		{ x: 1, y: y0 },
		{ x: x1, y: y1 },
		{ x: CURVE_MAX_LETTERS, y: y2 }
	];
}

function at(p0: number, p1: number, p2: number, t: number) {
	const u = 1 - t;
	return u * u * p0 + 2 * u * t * p1 + t * t * p2;
}

/** Sample the curve at each whole length: `[[1, m1], [2, m2], … [20, m20]]`. */
export function curveTable([p0, p1, p2]: [Point, Point, Point]): [number, number][] {
	const table: [number, number][] = [];
	for (let length = 1; length <= CURVE_MAX_LETTERS; length++) {
		// x(t) is monotonic, so bisect for the t where x(t) = length.
		let lo = 0;
		let hi = 1;
		for (let i = 0; i < 40; i++) {
			const mid = (lo + hi) / 2;
			if (at(p0.x, p1.x, p2.x, mid) < length) lo = mid;
			else hi = mid;
		}
		table.push([length, at(p0.y, p1.y, p2.y, (lo + hi) / 2)]);
	}
	return table;
}
