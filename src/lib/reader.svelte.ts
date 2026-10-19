import type { Book, Token } from './epub';
import { settings } from './settings.svelte';
import { getJSON, setJSON } from './storage';

const SENTENCE_END = /[.!?…]["'”’)\]]*$/;

function endsSentence(token: Token) {
	return 'img' in token || !!token.p || SENTENCE_END.test(token.w);
}

/**
 * How long to show a word, relative to one word at the base speed. Modifiers add their extra
 * time rather than multiply: a 2× word ending a 1.5× sentence gets 1 + 1 + 0.5 = 2.5×, not 3×.
 * Punctuation counts once, using the largest of sentence, clause and paragraph end, since a
 * paragraph end is also a sentence end.
 */
function pause(w: string, paragraphEnd: boolean) {
	const v = settings.values;
	let punctuation = 1;
	if (SENTENCE_END.test(w)) punctuation = v.sentenceFactor;
	else if (/[,;:—–]["'”’)\]]*$/.test(w)) punctuation = v.clauseFactor;
	if (paragraphEnd) punctuation = Math.max(punctuation, v.paragraphFactor);
	const letters = w.replace(/[^\p{L}\p{N}]/gu, '').length;
	const table = settings.lengthTable;
	const length = table[Math.min(Math.max(letters, 1), table.length) - 1][1];
	return 1 + (punctuation - 1) + (length - 1);
}

/** How much reading time (ms) the actual-speed average covers; time spent paused is left out. */
const AVERAGE_WINDOW = 60_000;

export class Reader {
	book = $state.raw<Book | null>(null);
	index = $state(0);
	playing = $state(false);
	/** Playing from the play button rather than a held finger. */
	continuous = $state(false);
	/** Speed set on the bar. */
	wpm = $state(getJSON('rsvp-wpm', 300));
	/** Words per minute actually shown over the last minute of reading, punctuation pauses included. */
	actualWpm = $state<number | null>(null);

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
	/** Display time of each recent word, for the actual-speed average. */
	#log: { ms: number; words: number }[] = [];
	#logMs = 0;
	#logWords = 0;
	#shownAt = 0;
	/** The position was chosen exactly (a tapped word), so don't snap back to the sentence start. */
	#exact = false;

	/** Show a book. The library owns parsed books, so switching away doesn't dispose them. */
	open(book: Book, key: string) {
		this.stop();
		this.save();
		this.book = book;
		this.#key = `rsvp-pos:${key}`;
		this.index = Math.min(getJSON(this.#key, 0), book.tokens.length - 1);
	}

	close() {
		this.stop();
		this.book = null;
	}

	/** Jump somewhere: `exact` keeps that word on resume instead of its sentence start. */
	seek(index: number, exact = true) {
		if (!this.book) return;
		this.index = Math.max(0, Math.min(index, this.book.tokens.length - 1));
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
		// A quick re-press carries on from the very word; after a real pause, from the sentence start.
		const quick = performance.now() - this.#liftedAt <= settings.values.retapWindow * 1000;
		if (quick && this.index === this.#liftedIndex) this.#exact = false;
		else this.#resumePosition();
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

	/** The rewind button: back up per the rewind settings, without stopping. */
	back() {
		if (!this.book) return;
		this.index = this.#rewindTarget(this.index);
		this.#exact = true;
		this.save();
		if (this.playing) this.#schedule();
	}

	/** The sentence around a word, for dictionary context. */
	sentenceAt(index: number) {
		const tokens = this.book?.tokens;
		if (!tokens) return '';
		let end = index;
		while (end < tokens.length - 1 && end - index < 60 && !endsSentence(tokens[end])) end++;
		let text = '';
		for (let i = this.#sentenceStart(index); i <= end; i++) {
			const t = tokens[i];
			if ('img' in t) continue;
			text += (text && !(t.h && t.h.i > 0) ? ' ' : '') + t.w;
		}
		return text;
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

	/** The neighboring word in page view terms: the parts of a hyphenated word count as one. */
	wordStep(from: number, dir: 1 | -1) {
		const tokens = this.book?.tokens;
		if (!tokens) return from;
		const span = (i: number) => {
			const t = tokens[i];
			return 'w' in t && t.s !== undefined ? t.s : i;
		};
		if (dir > 0) {
			let i = from + 1;
			while (i < tokens.length && span(i) === span(from)) i++;
			return i < tokens.length ? i : from;
		}
		const start = span(from);
		return start > 0 ? span(start - 1) : from;
	}

	#resumePosition() {
		if (this.#exact) {
			this.#exact = false;
			return;
		}
		// Back to the start of the sentence, but never further than a long sentence's worth.
		this.index = Math.max(this.#sentenceStart(this.index), this.index - 80);
	}

	#sentenceStart(index: number) {
		const tokens = this.book!.tokens;
		let i = index;
		while (i > 0 && !endsSentence(tokens[i - 1])) i--;
		return i;
	}

	/**
	 * Where a rewind from `from` lands. By words: a fixed distance back. By sentence: the start of
	 * this sentence; then keep going back a sentence while the jump is under the minimum (you're
	 * near the start) or the sentence landed on is shorter than the minimum. Capped at the maximum.
	 */
	#rewindTarget(from: number) {
		const v = settings.values;
		if (v.rewindMode === 'words') return Math.max(0, from - v.rewindWords);
		const min = v.rewindMinWords;
		let target = this.#sentenceStart(from);
		let next = from + 1; // Where the landed-on sentence ends (exclusive), for its length.
		while (target > 0 && (from - target < min || next - target < min)) {
			next = target;
			target = this.#sentenceStart(target - 1);
		}
		return Math.max(0, target, from - v.rewindMaxWords);
	}

	#schedule() {
		clearTimeout(this.#timer);
		const token = this.book!.tokens[this.index];
		const ms =
			'img' in token
				? settings.values.imageSeconds * 1000
				: (60000 / this.wpm) * pause(token.w, !!token.p);
		this.#shownAt = performance.now();
		this.#timer = setTimeout(() => this.#step(), ms);
	}

	#step() {
		const book = this.book;
		if (!this.playing || !book) return;
		if (this.index >= book.tokens.length - 1) {
			this.stop();
			return;
		}
		this.#record(book.tokens[this.index]);
		this.index++;
		this.#exact = false;
		if (++this.#sinceSave >= 25) this.save();
		this.#schedule();
	}

	/** Log how long a word was actually up. Later parts of a hyphenated word aren't new words. */
	#record(token: Token) {
		if ('img' in token) return;
		const entry = { ms: performance.now() - this.#shownAt, words: token.h && token.h.i > 0 ? 0 : 1 };
		this.#log.push(entry);
		this.#logMs += entry.ms;
		this.#logWords += entry.words;
		while (this.#logMs - this.#log[0].ms >= AVERAGE_WINDOW) {
			const old = this.#log.shift()!;
			this.#logMs -= old.ms;
			this.#logWords -= old.words;
		}
		// Wait for a few seconds of reading before showing an average.
		this.actualWpm = this.#logMs >= 3000 ? (this.#logWords * 60000) / this.#logMs : null;
	}
}

export const reader = new Reader();
