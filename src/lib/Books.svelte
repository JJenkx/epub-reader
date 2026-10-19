<script lang="ts">
	import { library } from './library.svelte';

	let { onadd, onclose }: { onadd: () => void; onclose: () => void } = $props();

	let busy = $state<string | null>(null);
	let error = $state('');

	async function open(id: string) {
		if (id === library.currentId) return onclose();
		busy = id;
		error = '';
		try {
			await library.open(id);
			onclose();
		} catch (e) {
			error = (e as Error).message;
		} finally {
			busy = null;
		}
	}

	async function remove(id: string, title: string) {
		if (!confirm(`Remove “${title}” from this device? Your place in it will be forgotten.`)) return;
		await library.remove(id);
	}

	library.touch();
</script>

<h2>Books</h2>
<ul>
	{#each library.books as book (book.id)}
		<li class={{ current: book.id === library.currentId }}>
			<button type="button" class="open" disabled={busy !== null} onclick={() => open(book.id)}>
				<span class="title">{book.title}</span>
				<span class="meta">
					{#if busy === book.id}
						Opening…
					{:else if book.progress !== null}
						{Math.round(book.progress * 100)}%
					{:else}
						Not started
					{/if}
					{#if book.id === library.currentId}· reading{/if}
				</span>
				{#if book.progress !== null}
					<span class="bar"><span style:width="{book.progress * 100}%"></span></span>
				{/if}
			</button>
			<button
				type="button"
				class="remove"
				aria-label="Remove {book.title}"
				onclick={() => remove(book.id, book.title)}
			>
				×
			</button>
		</li>
	{/each}
</ul>
{#if error}<p class="error">{error}</p>{/if}
<button type="button" class="add" onclick={onadd}>Add an EPUB…</button>
<p class="hint">Books are kept on this device, each with its own place.</p>

<style>
	h2 {
		margin: 0 0 8px;
		padding: 0 12px;
		font-size: 1rem;
	}

	ul {
		margin: 0;
		padding: 0;
		list-style: none;
	}

	li {
		display: flex;
		align-items: center;
		border-radius: 10px;
	}

	li.current {
		background: var(--track);
	}

	.open {
		display: grid;
		flex: 1;
		min-width: 0;
		gap: 3px;
		padding: 10px 12px;
		border: 0;
		background: none;
		color: var(--text);
		font: inherit;
		text-align: left;
	}

	.title {
		overflow: hidden;
		white-space: nowrap;
		text-overflow: ellipsis;
		font-weight: 600;
	}

	.meta {
		font-size: 0.8rem;
		color: var(--muted);
		font-variant-numeric: tabular-nums;
	}

	.bar {
		height: 2px;
		background: var(--border);
	}

	.bar span {
		display: block;
		height: 100%;
		background: var(--muted);
	}

	.remove {
		flex: none;
		width: 44px;
		height: 44px;
		border: 0;
		background: none;
		color: var(--muted);
		font-size: 1.3rem;
	}

	.add {
		margin: 12px 12px 0;
		padding: 10px 14px;
		border: 1px solid var(--border);
		border-radius: 8px;
		background: none;
		color: var(--text);
		font: inherit;
	}

	.hint,
	.error {
		padding: 0 12px;
		font-size: 0.8rem;
		color: var(--muted);
	}

	.error {
		color: var(--danger);
	}
</style>
