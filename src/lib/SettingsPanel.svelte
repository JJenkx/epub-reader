<script lang="ts">
	import CurveEditor from './CurveEditor.svelte';
	import { settings } from './settings.svelte';

</script>

<h2>Settings</h2>
<form onchange={() => settings.save()} onsubmit={(e) => e.preventDefault()}>
	<fieldset>
		<legend>Speed range (wpm)</legend>
		<div class="pair">
			<input type="number" inputmode="numeric" step="10" aria-label="Minimum wpm" bind:value={settings.values.minWpm} />
			<span>to</span>
			<input type="number" inputmode="numeric" step="10" aria-label="Maximum wpm" bind:value={settings.values.maxWpm} />
		</div>
	</fieldset>

	<fieldset>
		<legend>Display</legend>
		<label>
			<span>Font size</span>
			<span class="range">
				<input type="range" min="0.5" max="2.5" step="0.05" bind:value={settings.values.fontScale} />
				<output>{Math.round(settings.values.fontScale * 100)}%</output>
			</span>
		</label>
		<label>
			<span>Highlight focus letter</span>
			<input type="checkbox" bind:checked={settings.values.focusLetter} />
		</label>
		<p class="hint">Off: no colored letter, and each word is centered as a whole.</p>
		<label>
			<span>Show whole hyphenated word</span>
			<input type="checkbox" bind:checked={settings.values.hyphenContext} />
		</label>
		<p class="hint">On: the rest of the word is shown dimmed beside each part as it flashes.</p>
	</fieldset>

	<details class="group">
		<summary>Timing</summary>
		<div class="body">
			<p class="hint">How long a word stays up, as a multiple of one word at the current speed.</p>
			<label>
				<span>Sentence end (. ! ? …)</span>
				<input type="number" inputmode="decimal" step="0.1" min="1" bind:value={settings.values.sentenceFactor} />
			</label>
			<label>
				<span>Comma, colon, dash (, ; : —)</span>
				<input type="number" inputmode="decimal" step="0.1" min="1" bind:value={settings.values.clauseFactor} />
			</label>
			<label>
				<span>Paragraph end</span>
				<input type="number" inputmode="decimal" step="0.1" min="1" bind:value={settings.values.paragraphFactor} />
			</label>
			<label class={{ off: settings.values.lengthCurve }}>
				<span>Long word, at least (letters)</span>
				<input
					type="number"
					inputmode="numeric"
					step="1"
					min="1"
					disabled={settings.values.lengthCurve}
					bind:value={settings.values.longWordChars}
				/>
			</label>
			<label class={{ off: settings.values.lengthCurve }}>
				<span>Long word (× time)</span>
				<input
					type="number"
					inputmode="decimal"
					step="0.1"
					min="1"
					disabled={settings.values.lengthCurve}
					bind:value={settings.values.longWordFactor}
				/>
			</label>
			<label>
				<span>Picture (seconds)</span>
				<input type="number" inputmode="decimal" step="0.25" min="0" bind:value={settings.values.imageSeconds} />
			</label>
			<p class="hint">Punctuation uses the larger of its multipliers; word length multiplies on top.</p>

			<label>
				<span>Experimental: time by word length</span>
				<input type="checkbox" bind:checked={settings.values.lengthCurve} />
			</label>
			{#if settings.values.lengthCurve}
				<p class="hint">Replaces the long-word rule. Words over 20 letters use the 20-letter value.</p>
				<CurveEditor />
				<button type="button" class="link" onclick={() => settings.resetCurve()}>Reset curve</button>
			{/if}
		</div>
	</details>

	<fieldset>
		<legend>Rewind</legend>
		<div class="segmented" role="radiogroup" aria-label="Rewind by">
			<label><input type="radio" value="words" bind:group={settings.values.rewindMode} /> By words</label>
			<label><input type="radio" value="sentence" bind:group={settings.values.rewindMode} /> To sentence start</label>
		</div>
		{#if settings.values.rewindMode === 'words'}
			<label>
				<span>Back up by (words)</span>
				<input type="number" inputmode="numeric" step="1" min="0" bind:value={settings.values.rewindWords} />
			</label>
		{:else}
			<label>
				<span>Jump at least (words)</span>
				<input type="number" inputmode="numeric" step="1" min="0" bind:value={settings.values.rewindMinWords} />
			</label>
			<label>
				<span>Jump at most (words)</span>
				<input type="number" inputmode="numeric" step="1" min="1" bind:value={settings.values.rewindMaxWords} />
			</label>
			<p class="hint">
				Goes back to the start of the sentence. If that's less than the minimum (you're near the
				start, or the sentence is short), it goes back to the sentence before.
			</p>
		{/if}
		<label>
			<span>Re-press within (seconds)</span>
			<input type="number" inputmode="decimal" step="0.05" min="0" bind:value={settings.values.retapWindow} />
		</label>
		<label>
			<span>Replay at (× speed)</span>
			<input type="number" inputmode="decimal" step="0.05" min="0.1" max="1" bind:value={settings.values.catchUpFactor} />
		</label>
		<p class="hint">
			The rewind button (left of play) and a quick re-press of the speed bar both rewind. A re-press
			then replays slowly until you're back where you lifted.
		</p>
	</fieldset>

	<button type="button" class="link" onclick={() => settings.reset()}>Reset all to defaults</button>
</form>



<style>
	h2 {
		margin: 0 0 12px;
		font-size: 1rem;
	}

	form {
		display: grid;
		gap: 22px;
	}

	fieldset {
		display: grid;
		gap: 10px;
		margin: 0;
		padding: 0;
		border: 0;
	}

	legend {
		margin-bottom: 8px;
		font-size: 0.8rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		color: var(--muted);
	}

	label {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
	}

	.pair,
	.range {
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.range input {
		width: 140px;
	}

	output {
		width: 3.2em;
		text-align: right;
		font-variant-numeric: tabular-nums;
	}

	input[type='number'] {
		width: 80px;
		padding: 8px;
		border: 1px solid var(--border);
		border-radius: 8px;
		background: var(--bg);
		color: var(--text);
		font: inherit;
		font-size: 16px;
	}

	.off {
		opacity: 0.45;
	}

	.hint {
		margin: -4px 0 0;
		font-size: 0.8rem;
		color: var(--muted);
	}

	input[type='checkbox'] {
		width: 22px;
		height: 22px;
		accent-color: var(--accent);
	}

	input[type='range'] {
		accent-color: var(--accent);
	}

	button {
		padding: 10px 14px;
		border: 1px solid var(--border);
		border-radius: 8px;
		background: none;
		color: var(--text);
		font: inherit;
	}

	.link {
		justify-self: start;
		padding: 0;
		border: 0;
		color: var(--muted);
		text-decoration: underline;
	}

	.group .body {
		display: grid;
		gap: 10px;
		margin-top: 12px;
	}

	.group > summary {
		cursor: pointer;
		font-size: 0.8rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		color: var(--muted);
		list-style-position: inside;
	}

	.segmented {
		display: flex;
		gap: 6px;
	}

	.segmented label {
		flex: 1;
		justify-content: center;
		gap: 6px;
		padding: 8px;
		border: 1px solid var(--border);
		border-radius: 8px;
		font-size: 0.9rem;
	}

	.segmented label:has(input:checked) {
		border-color: var(--accent);
		color: var(--accent);
	}

	.segmented input {
		position: absolute;
		opacity: 0;
		pointer-events: none;
	}
</style>
