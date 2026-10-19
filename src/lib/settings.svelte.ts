import { controlPoints, curveTable, CURVE_MAX_LETTERS, CURVE_MAX_MULTIPLIER } from './curve';
import { getJSON, setJSON } from './storage';

export const DEFAULTS = {
	/** Base speed range of the bar: the speed of a plain word. Pauses only ever slow it down. */
	minWpm: 200,
	maxWpm: 800,
	/** Seconds after lifting in which a re-press resumes exactly where you left off. */
	retapWindow: 0.5,
	rewindWords: 15,
	/** Rewind by a fixed number of words, or to the start of a sentence. */
	rewindMode: 'words' as 'words' | 'sentence',
	/** Sentence rewinds go back at least this far (skipping to earlier sentences)... */
	rewindMinWords: 4,
	/** ...and no further than this. */
	rewindMaxWords: 60,
	/** Display-time multipliers for words ending a sentence, a clause, or a paragraph. */
	sentenceFactor: 1.5,
	clauseFactor: 1.3,
	paragraphFactor: 2,
	/** Seconds a picture stays on screen. */
	imageSeconds: 1,
	/**
	 * Word-length multiplier: a Bézier curve from the fixed point (1 letter, 1×) through two
	 * control points to (20 letters, curveY3).
	 */
	curveX1: 13,
	curveY1: 1.25,
	curveX2: 14,
	curveY2: 2.5,
	curveY3: 3,
	/** Trackpad (drag on the play/rewind area): drag this far before it starts moving... */
	scrubStartPx: 10,
	/** ...then this far sideways per word... */
	scrubWordPx: 22,
	/** ...and this far up or down per line. */
	scrubLinePx: 34,
	/** How far the highlight stretches toward the next word before it snaps. */
	scrubStrainPx: 6,
	/** Strain curve: 1 stretches evenly with the drag, higher holds back until near the snap. */
	scrubStrainCurve: 2,
	/** Length of the snap animation, in milliseconds. */
	scrubSnapMs: 110,
	/** Overshoot of the snap: 0 glides into place, higher bounces past and settles. */
	scrubSnapBounce: 0.4,
	/** Multiplier for both the flashed word and the page view text. */
	fontScale: 1,
	/** Highlight a focus letter and pin it to the center; otherwise center the whole word. */
	focusLetter: true,
	/** Show the rest of a hyphenated word, dimmed, beside the part being flashed. */
	hyphenContext: false
};

export type SettingsValues = typeof DEFAULTS;

const KEY = 'rsvp-settings';
const VERSION = 2;

/** Defaults that changed in version 2; saved copies of the old ones give way to the new. */
const OLD_DEFAULTS: Record<string, unknown> = {
	sentenceFactor: 1.8,
	curveX1: 8,
	curveY1: 1,
	curveX2: 14,
	curveY2: 1.3,
	curveY3: 2
};

/** Saved settings over the defaults, ignoring keys this version no longer uses. */
function load(): SettingsValues {
	const saved = getJSON<Record<string, unknown>>(KEY, {});
	if (saved.version !== VERSION) {
		if (saved.sentenceFactor === OLD_DEFAULTS.sentenceFactor) delete saved.sentenceFactor;
		// The curve was opt-in before; an untouched one becomes the new default curve.
		const curve = ['curveX1', 'curveY1', 'curveX2', 'curveY2', 'curveY3'];
		if (curve.every((k) => !(k in saved) || saved[k] === OLD_DEFAULTS[k])) {
			for (const k of curve) delete saved[k];
		}
	}
	const known = Object.fromEntries(Object.entries(saved).filter(([k]) => k in DEFAULTS));
	return { ...DEFAULTS, ...known } as SettingsValues;
}
const THEME_KEY = 'rsvp-theme';

class Settings {
	values = $state<SettingsValues>(load());
	// app.html applies a saved theme before first paint; otherwise follow the system.
	theme = $state<'light' | 'dark'>(
		(document.documentElement.dataset.theme as 'light' | 'dark' | undefined) ??
			(matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
	);

	/** The curve as [length, multiplier] pairs, recomputed only when a control point moves. */
	lengthTable = $derived(
		curveTable(
			controlPoints(
				this.values.curveX1,
				this.values.curveY1,
				this.values.curveX2,
				this.values.curveY2,
				this.values.curveY3
			)
		)
	);

	save() {
		const v = this.values;
		const num = (x: number, d: number) => (Number.isFinite(x) ? x : d);
		v.minWpm = Math.max(50, Math.round(num(v.minWpm, DEFAULTS.minWpm)));
		v.maxWpm = Math.max(v.minWpm + 50, Math.round(num(v.maxWpm, DEFAULTS.maxWpm)));
		v.retapWindow = Math.min(3, Math.max(0, num(v.retapWindow, DEFAULTS.retapWindow)));
		v.rewindWords = Math.max(0, Math.round(num(v.rewindWords, DEFAULTS.rewindWords)));
		v.rewindMode = v.rewindMode === 'sentence' ? 'sentence' : 'words';
		v.rewindMinWords = Math.max(0, Math.round(num(v.rewindMinWords, DEFAULTS.rewindMinWords)));
		v.rewindMaxWords = Math.max(
			Math.max(1, v.rewindMinWords),
			Math.round(num(v.rewindMaxWords, DEFAULTS.rewindMaxWords))
		);
		v.fontScale = Math.min(2.5, Math.max(0.5, num(v.fontScale, DEFAULTS.fontScale)));
		v.sentenceFactor = Math.min(5, Math.max(1, num(v.sentenceFactor, DEFAULTS.sentenceFactor)));
		v.clauseFactor = Math.min(5, Math.max(1, num(v.clauseFactor, DEFAULTS.clauseFactor)));
		v.paragraphFactor = Math.min(5, Math.max(1, num(v.paragraphFactor, DEFAULTS.paragraphFactor)));
		v.imageSeconds = Math.min(10, Math.max(0, num(v.imageSeconds, DEFAULTS.imageSeconds)));
		const y = (n: number, d: number) => Math.min(CURVE_MAX_MULTIPLIER, Math.max(1, num(n, d)));
		v.curveY1 = y(v.curveY1, DEFAULTS.curveY1);
		v.curveY2 = y(v.curveY2, DEFAULTS.curveY2);
		v.curveY3 = y(v.curveY3, DEFAULTS.curveY3);
		v.curveX1 = Math.min(CURVE_MAX_LETTERS, Math.max(1, num(v.curveX1, DEFAULTS.curveX1)));
		v.curveX2 = Math.min(CURVE_MAX_LETTERS, Math.max(v.curveX1, num(v.curveX2, DEFAULTS.curveX2)));
		const clamp = (n: number, d: number, lo: number, hi: number) =>
			Math.min(hi, Math.max(lo, num(n, d)));
		v.scrubStartPx = clamp(v.scrubStartPx, DEFAULTS.scrubStartPx, 2, 60);
		v.scrubWordPx = clamp(v.scrubWordPx, DEFAULTS.scrubWordPx, 4, 200);
		v.scrubLinePx = clamp(v.scrubLinePx, DEFAULTS.scrubLinePx, 4, 200);
		v.scrubStrainPx = clamp(v.scrubStrainPx, DEFAULTS.scrubStrainPx, 0, 40);
		v.scrubStrainCurve = clamp(v.scrubStrainCurve, DEFAULTS.scrubStrainCurve, 0.25, 6);
		v.scrubSnapMs = clamp(v.scrubSnapMs, DEFAULTS.scrubSnapMs, 0, 1000);
		v.scrubSnapBounce = clamp(v.scrubSnapBounce, DEFAULTS.scrubSnapBounce, 0, 2);
		v.focusLetter = v.focusLetter !== false;
		v.hyphenContext = v.hyphenContext === true;
		setJSON(KEY, { ...v, version: VERSION });
	}

	/** Put back one group of settings. */
	resetKeys(keys: (keyof SettingsValues)[]) {
		for (const k of keys) (this.values as Record<string, unknown>)[k] = DEFAULTS[k];
		this.save();
	}

	reset() {
		this.values = { ...DEFAULTS };
		this.save();
	}

	resetCurve() {
		const { curveX1, curveY1, curveX2, curveY2, curveY3 } = DEFAULTS;
		Object.assign(this.values, { curveX1, curveY1, curveX2, curveY2, curveY3 });
		this.save();
	}

	toggleTheme() {
		this.theme = this.theme === 'dark' ? 'light' : 'dark';
		document.documentElement.dataset.theme = this.theme;
		try {
			localStorage.setItem(THEME_KEY, this.theme);
		} catch {
			// Theme just won't persist.
		}
	}
}

export const settings = new Settings();
