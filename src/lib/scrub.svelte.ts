import { reader } from './reader.svelte';
import { settings } from './settings.svelte';

/** Finds the word on the next line up or down from `index`, nearest to `goalX` (page px). */
export type LineFinder = (index: number, dir: 1 | -1, goalX: number | null) => { index: number; x: number } | null;

/**
 * Trackpad navigation: dragging on the play/rewind area moves the reading position a whole word
 * (or line) at a time. Between snaps, `x` and `y` say how far the drag has pulled toward the
 * next word, from -1 to 1, which the page view shows as the highlight straining that way.
 */
class Scrub {
	active = $state(false);
	x = $state(0);
	y = $state(0);
	/** Registered by the page view while it's showing. */
	lines: LineFinder | null = null;

	#accX = 0;
	#accY = 0;
	/** The column vertical moves aim for, kept across lines like a text cursor. */
	#goalX: number | null = null;

	begin() {
		this.active = true;
		this.#accX = this.#accY = 0;
		this.#goalX = null;
		this.x = this.y = 0;
	}

	/** Feed in pointer movement since the last call. */
	move(dx: number, dy: number) {
		const { scrubWordPx, scrubLinePx } = settings.values;
		this.#accX = this.#walk(this.#accX + dx, scrubWordPx, (dir) => {
			const next = reader.wordStep(reader.index, dir);
			if (next === reader.index) return false;
			this.#goalX = null;
			reader.seek(next);
			return true;
		});
		this.#accY = this.#walk(this.#accY + dy, scrubLinePx, (dir) => {
			const hit = this.lines?.(reader.index, dir, this.#goalX);
			if (!hit) return false;
			this.#goalX = hit.x;
			reader.seek(hit.index);
			return true;
		});
		this.x = this.#accX / scrubWordPx;
		this.y = this.#accY / scrubLinePx;
	}

	end() {
		this.active = false;
		this.x = this.y = 0;
	}

	/**
	 * Take a step for each whole `step` of drag. With nowhere to go, hold just short of the snap
	 * so the highlight stays strained against the edge.
	 */
	#walk(acc: number, step: number, go: (dir: 1 | -1) => boolean) {
		while (Math.abs(acc) >= step) {
			const dir = acc > 0 ? 1 : -1;
			if (!go(dir)) return dir * step * 0.999;
			acc -= dir * step;
		}
		return acc;
	}
}

export const scrub = new Scrub();
