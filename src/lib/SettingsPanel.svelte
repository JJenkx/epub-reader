<script lang="ts">
	import { settings } from './settings.svelte';

	let { onopen, onremove }: { onopen: () => void; onremove: () => void } = $props();
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

	<fieldset>
		<legend>Long words</legend>
		<label>
			<span>At least (letters)</span>
			<input type="number" inputmode="numeric" step="1" min="1" bind:value={settings.values.longWordChars} />
		</label>
		<label>
			<span>Show for (× time)</span>
			<input type="number" inputmode="decimal" step="0.1" min="1" bind:value={settings.values.longWordFactor} />
		</label>
	</fieldset>

	<fieldset>
		<legend>Rewind</legend>
		<label>
			<span>Re-press within (seconds)</span>
			<input type="number" inputmode="decimal" step="0.05" min="0" bind:value={settings.values.retapWindow} />
		</label>
		<label>
			<span>Back up by (words)</span>
			<input type="number" inputmode="numeric" step="1" min="0" bind:value={settings.values.rewindWords} />
		</label>
		<label>
			<span>Replay at (× speed)</span>
			<input type="number" inputmode="decimal" step="0.05" min="0.1" max="1" bind:value={settings.values.catchUpFactor} />
		</label>
	</fieldset>
	<p class="hint">
		A quick re-press of the bar backs up and replays slowly. While playing, a tap on the left side
		of the screen backs up too.
	</p>

	<button type="button" class="link" onclick={() => settings.reset()}>Reset to defaults</button>
</form>

<div class="book">
	<button type="button" onclick={onopen}>Open another EPUB…</button>
	<button type="button" class="danger" onclick={onremove}>Remove book</button>
</div>

<style>
	h2 {
		margin: 0 0 12px;
		font-size: 1rem;
	}

	form {
		display: grid;
		gap: 14px;
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

	.hint {
		margin: -8px 0 0;
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

	.book {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
		margin-top: 24px;
		padding-top: 16px;
		border-top: 1px solid var(--border);
	}

	.danger {
		color: var(--danger);
	}
</style>
