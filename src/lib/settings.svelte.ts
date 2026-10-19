import { controlPoints, curveTable, CURVE_MAX_LETTERS, CURVE_MAX_MULTIPLIER } from './curve';
import { getJSON, setJSON } from './storage';

export const DEFAULTS = {
	minWpm: 200,
	maxWpm: 800,
	/** Seconds between lifting and re-pressing that counts as a rewind. */
	retapWindow: 0.5,
	rewindWords: 15,
	/** Fraction of the selected speed used while catching back up. */
	catchUpFactor: 0.5,
	/** Display-time multipliers for words ending a sentence, a clause, or a paragraph. */
	sentenceFactor: 1.8,
	clauseFactor: 1.3,
	paragraphFactor: 2,
	/** Words (or hyphenated parts) at least this many letters long stay up longer... */
	longWordChars: 11,
	/** ...by this factor. */
	longWordFactor: 1.5,
	/** Seconds a picture stays on screen. */
	imageSeconds: 1,
	/** Experimental: multiplier from a Bézier curve over word length, replacing the long-word rule. */
	lengthCurve: false,
	curveY0: 1,
	curveX1: 12,
	curveY1: 1,
	curveY2: 2,
	/** Multiplier for both the flashed word and the page view text. */
	fontScale: 1,
	/** Highlight a focus letter and pin it to the center; otherwise center the whole word. */
	focusLetter: true,
	/** Show the rest of a hyphenated word, dimmed, beside the part being flashed. */
	hyphenContext: false
};

export type SettingsValues = typeof DEFAULTS;

const KEY = 'rsvp-settings';
const THEME_KEY = 'rsvp-theme';

class Settings {
	values = $state<SettingsValues>({ ...DEFAULTS, ...getJSON<Partial<SettingsValues>>(KEY, {}) });
	// app.html applies a saved theme before first paint; otherwise follow the system.
	theme = $state<'light' | 'dark'>(
		(document.documentElement.dataset.theme as 'light' | 'dark' | undefined) ??
			(matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
	);

	/** The curve as [length, multiplier] pairs, recomputed only when a control point moves. */
	lengthTable = $derived(
		curveTable(controlPoints(this.values.curveY0, this.values.curveX1, this.values.curveY1, this.values.curveY2))
	);

	save() {
		const v = this.values;
		const num = (x: number, d: number) => (Number.isFinite(x) ? x : d);
		v.minWpm = Math.max(50, Math.round(num(v.minWpm, DEFAULTS.minWpm)));
		v.maxWpm = Math.max(v.minWpm + 50, Math.round(num(v.maxWpm, DEFAULTS.maxWpm)));
		v.retapWindow = Math.min(3, Math.max(0, num(v.retapWindow, DEFAULTS.retapWindow)));
		v.rewindWords = Math.max(0, Math.round(num(v.rewindWords, DEFAULTS.rewindWords)));
		v.catchUpFactor = Math.min(1, Math.max(0.1, num(v.catchUpFactor, DEFAULTS.catchUpFactor)));
		v.fontScale = Math.min(2.5, Math.max(0.5, num(v.fontScale, DEFAULTS.fontScale)));
		v.longWordChars = Math.max(1, Math.round(num(v.longWordChars, DEFAULTS.longWordChars)));
		v.longWordFactor = Math.min(5, Math.max(1, num(v.longWordFactor, DEFAULTS.longWordFactor)));
		v.sentenceFactor = Math.min(5, Math.max(1, num(v.sentenceFactor, DEFAULTS.sentenceFactor)));
		v.clauseFactor = Math.min(5, Math.max(1, num(v.clauseFactor, DEFAULTS.clauseFactor)));
		v.paragraphFactor = Math.min(5, Math.max(1, num(v.paragraphFactor, DEFAULTS.paragraphFactor)));
		v.imageSeconds = Math.min(10, Math.max(0, num(v.imageSeconds, DEFAULTS.imageSeconds)));
		v.lengthCurve = v.lengthCurve === true;
		const y = (n: number, d: number) => Math.min(CURVE_MAX_MULTIPLIER, Math.max(1, num(n, d)));
		v.curveY0 = y(v.curveY0, DEFAULTS.curveY0);
		v.curveY1 = y(v.curveY1, DEFAULTS.curveY1);
		v.curveY2 = y(v.curveY2, DEFAULTS.curveY2);
		v.curveX1 = Math.min(CURVE_MAX_LETTERS, Math.max(1, num(v.curveX1, DEFAULTS.curveX1)));
		v.focusLetter = v.focusLetter !== false;
		v.hyphenContext = v.hyphenContext === true;
		setJSON(KEY, v);
	}

	reset() {
		this.values = { ...DEFAULTS };
		this.save();
	}

	resetCurve() {
		const { curveY0, curveX1, curveY1, curveY2 } = DEFAULTS;
		Object.assign(this.values, { curveY0, curveX1, curveY1, curveY2 });
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
