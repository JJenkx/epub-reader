<script lang="ts">
	import { ankiExport, cleanWord, lookup, NotFound } from './dictionary';
	import { deleteEntry, listEntries, type DictionaryEntry } from './storage';

	let { word, context }: { word: string; context?: { sentence: string; book: string } } = $props();

	// Seeded once from the word under the cursor when the panel opens; then it's the user's input.
	// svelte-ignore state_referenced_locally
	let query = $state(cleanWord(word));
	let result = $state<DictionaryEntry | null>(null);
	let error = $state('');
	let loading = $state(false);
	let saved = $state<DictionaryEntry[]>([]);
	let filter = $state('');

	const shown = $derived(
		saved
			.filter((e) => e.word.includes(filter.trim().toLowerCase()))
			.sort((a, b) => b.added - a.added)
	);

	async function refresh() {
		saved = await listEntries();
	}

	async function search(raw = query) {
		const w = cleanWord(raw);
		if (!w) return;
		query = w;
		loading = true;
		error = '';
		result = null;
		try {
			// Only attach the reading context when looking up the word from the book.
			result = await lookup(w, w === cleanWord(word) ? context : undefined);
			await refresh();
		} catch (e) {
			error =
				e instanceof NotFound
					? e.message
					: navigator.onLine
						? (e as Error).message
						: 'You’re offline, and this word isn’t saved yet.';
		} finally {
			loading = false;
		}
	}

	async function remove(w: string) {
		await deleteEntry(w);
		if (result?.word === w) result = null;
		await refresh();
	}

	function exportAnki() {
		const url = URL.createObjectURL(ankiExport(shown.length ? shown : saved));
		const a = document.createElement('a');
		a.href = url;
		a.download = 'epub-reader-anki.txt';
		a.click();
		setTimeout(() => URL.revokeObjectURL(url), 1000);
	}

	refresh();
	search();
</script>

<h2>Dictionary</h2>
<form
	class="search"
	onsubmit={(e) => {
		e.preventDefault();
		search();
	}}
>
	<input type="search" placeholder="Look up a word" autocapitalize="off" bind:value={query} />
	<button type="submit">Look up</button>
</form>

{#if loading}
	<p class="muted">Looking up…</p>
{:else if error}
	<p class="muted">{error}</p>
{:else if result}
	<article class="entry">
		<h3>{result.word} {#if result.phonetic}<span class="muted">{result.phonetic}</span>{/if}</h3>
		{#each result.meanings as m (m.partOfSpeech)}
			<p class="pos">{m.partOfSpeech}</p>
			<ol>
				{#each m.definitions as d, i (i)}
					<li>{d}</li>
				{/each}
			</ol>
		{/each}
		{#if result.context}
			<p class="context">“{result.context}”</p>
		{/if}
	</article>
{/if}

<section class="saved">
	<div class="head">
		<h3>Saved words <span class="muted">({saved.length})</span></h3>
		<button type="button" disabled={!saved.length} onclick={exportAnki}>Export for Anki</button>
	</div>
	{#if saved.length > 5}
		<input type="search" placeholder="Filter" bind:value={filter} />
	{/if}
	<ul>
		{#each shown as e (e.word)}
			<li>
				<button type="button" class="word" onclick={() => search(e.word)}>
					<strong>{e.word}</strong>
					<span class="muted">{e.meanings[0]?.definitions[0] ?? ''}</span>
				</button>
				<button type="button" class="remove" aria-label="Remove {e.word}" onclick={() => remove(e.word)}>
					×
				</button>
			</li>
		{/each}
	</ul>
	<p class="hint">
		Saved words work offline. New lookups go to Wiktionary. The export imports into Anki as
		a deck named “EPUB Reader”.
	</p>
</section>

<style>
	h2 {
		margin: 0 0 12px;
		font-size: 1rem;
	}

	h3 {
		margin: 0;
		font-size: 1rem;
	}

	.search {
		display: flex;
		gap: 8px;
	}

	input[type='search'] {
		flex: 1;
		min-width: 0;
		width: 100%;
		padding: 9px 10px;
		border: 1px solid var(--border);
		border-radius: 8px;
		background: var(--bg);
		color: var(--text);
		font: inherit;
		font-size: 16px;
	}

	button {
		padding: 9px 12px;
		border: 1px solid var(--border);
		border-radius: 8px;
		background: none;
		color: var(--text);
		font: inherit;
	}

	button:disabled {
		opacity: 0.4;
	}

	.muted {
		color: var(--muted);
		font-weight: normal;
	}

	.entry {
		margin: 16px 0;
		padding: 12px 14px;
		border-radius: 10px;
		background: var(--bg);
	}

	.entry h3 {
		font-size: 1.2rem;
	}

	.pos {
		margin: 10px 0 2px;
		font-size: 0.8rem;
		font-style: italic;
		color: var(--muted);
	}

	ol {
		margin: 0;
		padding-left: 1.3em;
	}

	ol li {
		margin: 3px 0;
		line-height: 1.4;
	}

	.context {
		margin: 12px 0 0;
		font-family: var(--page-font);
		font-size: 0.9rem;
		color: var(--muted);
	}

	.saved {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: 8px;
		margin-top: 20px;
		padding-top: 16px;
		border-top: 1px solid var(--border);
	}

	.head {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
	}

	ul {
		margin: 0;
		padding: 0;
		list-style: none;
	}

	ul li {
		display: flex;
		align-items: center;
		min-width: 0;
	}

	.word {
		display: flex;
		flex: 1;
		min-width: 0;
		gap: 8px;
		padding: 8px 4px;
		border: 0;
		text-align: left;
	}

	.word span {
		overflow: hidden;
		white-space: nowrap;
		text-overflow: ellipsis;
	}

	.remove {
		flex: none;
		width: 36px;
		padding: 6px;
		border: 0;
		color: var(--muted);
		font-size: 1.2rem;
	}

	.hint {
		margin: 4px 0 0;
		font-size: 0.8rem;
		color: var(--muted);
	}
</style>
