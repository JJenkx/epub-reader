import type { Book, Token } from './epub';
import { settings } from './settings.svelte';
import { getJSON, setJSON } from './storage';

const SENTENCE_END = /[.!?…]["'”’)\]]*$/;

function endsSentence(token: Token) {
	return 'img' in token || !!token.p || SENTENCE_END.test(token.w);
}

/** How long to show a word, relative to one word at the current speed. */
function pause(w: string, paragraphEnd: boolean) {
	const v = settings.values;
	let m = 1;
	if (SENTENCE_END.test(w)) m = v.sentenceFactor;
	else if (/[,;:—–]["'”’)\]]*$/.test(w)) m = v.clauseFactor;
	if (paragraphEnd) m = Math.max(m, v.paragraphFactor);
	const letters = w.replace(/[^\p{L}\p{N}]/gu, '').length;
	if (v.lengthCurve) {
		const table = settings.lengthTable;
		m *= table[Math.min(Math.max(letters, 1), table.length) - 1][1];
	} else if (letters >= v.longWordChars) {
		m *= v.longWordFactor;
	}
	return m;
}

export class Reader {
	book = $state.raw<Book | null>(null);
	index = $state(0);
	playing = $state(false);
	/** Playing from the play button rather than a held finger. */
	continuous = $state(false);
	/** Speed set on the bar. */
	wpm = $state(getJSON('rsvp-wpm', 300));
	/** While set, play at reduced speed until this index is reached. */
	catchUpUntil = $state<number | null>(null);

	rate = $derived(this.catchUpUntil === null ? this.wpm : this.wpm * settings.values.catchUpFactor);
	token = $derived(this.book?.tokens[this.index] ?? null);
	progress = $derived(this.book ? this.index / Math.max(1, this.book.tokens.length - 1) : 0);
	chapterTitle = $derived.by(() => {
		let best: string | null = null;
		let bestIndex = -1;
		for (const item of this.book?.toc ?? []) {
			if (item.index <= this.index && item.index >= bestIndex) {
				best = item.label;
				bestIndex = item.index;
			}
		}
		return best;
	});

	#key = '';
	#timer: ReturnType<typeof setTimeout> | undefined;
	#liftedAt = -Infinity;
	#liftedIndex = 0;
	#sinceSave = 0;
	/** The position was chosen exactly (a tapped word), so don't snap back to the sentence start. */
	#exact = false;

	open(book: Book, key: string) {
		this.stop();
		this.book?.dispose();
		this.book = book;
		this.#key = `rsvp-pos:${key}`;
		this.catchUpUntil = null;
		this.index = Math.min(getJSON(this.#key, 0), book.tokens.length - 1);
	}

	close() {
		this.stop();
		this.book?.dispose();
		this.book = null;
	}

	/** Jump somewhere: `exact` keeps that word on resume instead of its sentence start. */
	seek(index: number, exact = true) {
		if (!this.book) return;
		this.index = Math.max(0, Math.min(index, this.book.tokens.length - 1));
		this.catchUpUntil = null;
		this.#liftedAt = -Infinity;
		this.#exact = exact;
		this.save();
		if (this.playing) this.#schedule();
	}

	/** Finger down on the speed bar. */
	press(wpm: number) {
		if (!this.book) return;
		this.wpm = wpm;
		if (this.playing) return; // Continuous mode: the bar only adjusts speed.
		const { retapWindow, rewindWords } = settings.values;
		if (performance.now() - this.#liftedAt <= retapWindow * 1000) {
			// Quick re-press: back up and replay slowly until we're back where we lifted.
			const target = Math.max(this.catchUpUntil ?? 0, this.#liftedIndex);
			this.index = Math.max(0, this.#liftedIndex - rewindWords);
			this.catchUpUntil = target > this.index ? target : null;
		} else {
			this.#resumePosition();
		}
		this.playing = true;
		this.#schedule();
	}

	/** Finger up. Returns true if this paused reading. */
	release() {
		if (!this.playing || this.continuous) return false;
		this.stop();
		this.#liftedAt = performance.now();
		this.#liftedIndex = this.index;
		return true;
	}

	play() {
		if (!this.book || this.playing) return;
		this.#resumePosition();
		this.continuous = true;
		this.playing = true;
		this.#schedule();
	}

	/** Back up by the rewind setting without stopping. */
	back() {
		if (!this.book) return;
		this.index = Math.max(0, this.index - settings.values.rewindWords);
		this.catchUpUntil = null;
		if (this.playing) this.#schedule();
	}

	stop() {
		clearTimeout(this.#timer);
		this.#timer = undefined;
		if (this.playing) this.save();
		this.playing = false;
		this.continuous = false;
	}

	save() {
		if (this.book) setJSON(this.#key, this.index);
		setJSON('rsvp-wpm', this.wpm);
		this.#sinceSave = 0;
	}

	#resumePosition() {
		this.catchUpUntil = null;
		if (this.#exact) {
			this.#exact = false;
			return;
		}
		const tokens = this.book!.tokens;
		let i = this.index;
		// Back to the start of the sentence, but never further than a long sentence's worth.
		while (i > 0 && this.index - i < 80 && !endsSentence(tokens[i - 1])) i--;
		this.index = i;
	}

	#schedule() {
		clearTimeout(this.#timer);
		const token = this.book!.tokens[this.index];
		const ms =
			'img' in token
				? settings.values.imageSeconds * 1000
				: (60000 / this.rate) * pause(token.w, !!token.p);
		this.#timer = setTimeout(() => this.#step(), ms);
	}

	#step() {
		const book = this.book;
		if (!this.playing || !book) return;
		if (this.index >= book.tokens.length - 1) {
			this.stop();
			return;
		}
		this.index++;
		this.#exact = false;
		if (this.catchUpUntil !== null && this.index >= this.catchUpUntil) this.catchUpUntil = null;
		if (++this.#sinceSave >= 25) this.save();
		this.#schedule();
	}
}

export const reader = new Reader();
