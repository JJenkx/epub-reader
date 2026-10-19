<script lang="ts">
	import { reader } from './reader.svelte';

	let { onclose }: { onclose: () => void } = $props();

	const items = $derived(reader.book?.toc ?? []);
	const currentIndex = $derived.by(() => {
		let best = -1;
		items.forEach((item, i) => {
			if (item.index <= reader.index && (best < 0 || item.index >= items[best].index)) best = i;
		});
		return best;
	});

	function scrollCurrent(node: HTMLElement) {
		node.querySelector('.current')?.scrollIntoView({ block: 'center' });
	}
</script>

<h2>Contents</h2>
{#if items.length}
	<ol {@attach scrollCurrent}>
		{#each items as item, i (i)}
			<li>
				<button
					class={{ current: i === currentIndex }}
					style:padding-left="{12 + item.depth * 16}px"
					onclick={() => {
						reader.seek(item.index);
						onclose();
					}}
				>
					{item.label}
				</button>
			</li>
		{/each}
	</ol>
{:else}
	<p class="empty">This book has no table of contents.</p>
{/if}

<style>
	h2 {
		margin: 0 0 8px;
		padding: 0 12px;
		font-size: 1rem;
	}

	ol {
		margin: 0;
		padding: 0;
		list-style: none;
	}

	button {
		display: block;
		width: 100%;
		padding: 10px 12px;
		border: 0;
		border-radius: 8px;
		background: none;
		color: var(--text);
		font: inherit;
		text-align: left;
	}

	button:hover {
		background: var(--track);
	}

	.current {
		color: var(--accent);
		font-weight: 600;
	}

	.empty {
		padding: 0 12px;
		color: var(--muted);
	}
</style>
