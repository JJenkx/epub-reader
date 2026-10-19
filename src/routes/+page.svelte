<script lang="ts">
	import { parseEpub } from '#lib/epub.ts';
	import PageView from '#lib/PageView.svelte';
	import { reader } from '#lib/reader.svelte.ts';
	import SettingsPanel from '#lib/SettingsPanel.svelte';
	import { settings } from '#lib/settings.svelte.ts';
	import SpeedBar from '#lib/SpeedBar.svelte';
	import { clearBook, loadBook, saveBook } from '#lib/storage.ts';
	import Toc from '#lib/Toc.svelte';
	import WordDisplay from '#lib/WordDisplay.svelte';

	let status = $state<'loading' | 'empty' | 'ready'>('loading');
	let error = $state('');
	let panel = $state<'toc' | 'settings' | null>(null);
	let pageView = $state(false);
	let fileInput: HTMLInputElement | undefined = $state();

	async function open(name: string, data: Blob) {
		const book = await parseEpub(data);
		reader.open(book, `${name}:${data.size}`);
		document.title = book.title;
		status = 'ready';
	}

	async function restore() {
		try {
			const stored = await loadBook();
			if (stored) return await open(stored.name, stored.data);
		} catch (e) {
			error = `Couldn't reopen the saved book: ${(e as Error).message}`;
		}
		status = 'empty';
	}

	restore();

	async function onfile(e: Event & { currentTarget: HTMLInputElement }) {
		const file = e.currentTarget.files?.[0];
		e.currentTarget.value = '';
		if (!file) return;
		panel = null;
		error = '';
		status = 'loading';
		try {
			await open(file.name, file);
			await saveBook({ name: file.name, data: file });
		} catch (err) {
			error = `Couldn't open ${file.name}: ${(err as Error).message}`;
			status = reader.book ? 'ready' : 'empty';
		}
	}

	async function remove() {
		panel = null;
		reader.close();
		await clearBook();
		document.title = 'EPUB Reader';
		status = 'empty';
	}

	let pageTimer: ReturnType<typeof setTimeout> | undefined;

	function togglePage() {
		reader.stop();
		pageView = !pageView;
	}

	function openPanel(which: 'toc' | 'settings') {
		reader.stop();
		panel = which;
	}

	function showRsvp() {
		clearTimeout(pageTimer);
		pageView = false;
	}

	/** Paused: show the page, after the re-press window so a quick rewind doesn't flash it. */
	function paused(delay = settings.values.retapWindow * 1000) {
		clearTimeout(pageTimer);
		pageTimer = setTimeout(() => {
			if (!reader.playing && reader.book) pageView = true;
		}, delay);
	}

	function togglePlay() {
		if (reader.continuous) {
			reader.stop();
			paused(0);
		} else {
			showRsvp();
			reader.play();
		}
	}

	/** While reading continuously, a tap on the left half of the screen backs up. */
	function tapBack(e: PointerEvent) {
		if (!reader.continuous || e.clientX >= innerWidth / 2) return;
		if ((e.target as Element).closest('header, footer, aside, button')) return;
		reader.back();
	}
</script>

<svelte:window onpagehide={() => reader.save()} />
<svelte:document
	onpointerdown={tapBack}
	onvisibilitychange={() => {
		if (document.hidden && reader.playing) {
			reader.stop();
			paused(0);
		}
	}}
/>

<input bind:this={fileInput} type="file" accept=".epub,application/epub+zip" hidden onchange={onfile} />

<div class="app">
	<header>
		<div class="left">
			{#if status === 'ready'}
				<button class="icon" aria-label="Table of contents" onclick={() => openPanel('toc')}>
					<svg viewBox="0 0 24 24"><path d="M4 6h16M4 12h16M4 18h10" /></svg>
				</button>
				<span class="title">{reader.book?.title}</span>
			{/if}
		</div>
		<div class="right">
			{#if status === 'ready'}
				<button
					class={['icon', { on: pageView }]}
					aria-label="Page view"
					aria-pressed={pageView}
					onclick={togglePage}
				>
					<svg viewBox="0 0 24 24"><path d="M12 6c-2-1.5-5-2-8-2v14c3 0 6 .5 8 2 2-1.5 5-2 8-2V4c-3 0-6 .5-8 2zm0 0v14" /></svg>
				</button>
			{/if}
			<button
				class="icon"
				aria-label={settings.theme === 'dark' ? 'Light mode' : 'Dark mode'}
				onclick={() => settings.toggleTheme()}
			>
				{#if settings.theme === 'dark'}
					<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></svg>
				{:else}
					<svg viewBox="0 0 24 24"><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" /></svg>
				{/if}
			</button>
			<button class="icon" aria-label="Settings" onclick={() => openPanel('settings')}>
				<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" /></svg>
			</button>
		</div>
	</header>

	<main>
		{#if status === 'loading'}
			<p class="center muted">Loading…</p>
		{:else if status === 'empty'}
			<div class="center">
				<button class="open" onclick={() => fileInput?.click()}>Open an EPUB</button>
				<p class="muted">Your book stays on this device.</p>
			</div>
		{:else if pageView}
			<PageView />
		{:else}
			<WordDisplay />
		{/if}
		{#if error}
			<p class="error" role="alert">{error}</p>
		{/if}
	</main>

	{#if status === 'ready'}
		<footer>
			<div class="meta">
				<span class="chapter">{reader.chapterTitle ?? ''}</span>
				<span>{Math.round(reader.progress * 100)}%</span>
			</div>
			<div class="progress"><div style:width="{reader.progress * 100}%"></div></div>
			<div class="controls">
				<button
					class="play"
					aria-label={reader.continuous ? 'Pause' : 'Play'}
					onclick={togglePlay}
				>
					{#if reader.continuous}
						<svg viewBox="0 0 24 24"><rect x="6" y="5" width="4" height="14" rx="1" /><rect x="14" y="5" width="4" height="14" rx="1" /></svg>
					{:else}
						<svg viewBox="0 0 24 24"><path d="M8 5.5v13a1 1 0 0 0 1.5.9l10.4-6.5a1 1 0 0 0 0-1.8L9.5 4.6A1 1 0 0 0 8 5.5z" /></svg>
					{/if}
				</button>
				<div class="speed"><SpeedBar onpress={showRsvp} onpause={() => paused()} /></div>
			</div>
		</footer>
	{/if}
</div>

{#if panel}
	<div class="scrim" role="presentation" onclick={() => (panel = null)}></div>
	<aside class={['sheet', panel]}>
		<button class="icon close" aria-label="Close" onclick={() => (panel = null)}>
			<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18" /></svg>
		</button>
		{#if panel === 'toc'}
			<Toc onclose={() => (panel = null)} />
		{:else}
			<SettingsPanel onopen={() => fileInput?.click()} onremove={remove} />
		{/if}
	</aside>
{/if}

<style>
	.app {
		display: flex;
		flex-direction: column;
		height: 100dvh;
		padding: env(safe-area-inset-top) env(safe-area-inset-right) 0 env(safe-area-inset-left);
	}

	header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
		padding: 6px 8px;
	}

	.left,
	.right {
		display: flex;
		align-items: center;
		min-width: 0;
	}

	.right {
		gap: 14px;
	}

	.title {
		overflow: hidden;
		font-size: 0.9rem;
		color: var(--muted);
		white-space: nowrap;
		text-overflow: ellipsis;
	}

	.icon {
		display: grid;
		flex: none;
		place-items: center;
		width: 44px;
		height: 44px;
		padding: 0;
		border: 0;
		border-radius: 10px;
		background: none;
		color: var(--text);
	}

	.icon.on {
		color: var(--accent);
	}

	.icon svg {
		width: 22px;
		height: 22px;
		fill: none;
		stroke: currentColor;
		stroke-width: 1.8;
		stroke-linecap: round;
		stroke-linejoin: round;
	}

	main {
		position: relative;
		flex: 1;
		min-height: 0;
	}

	.center {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		height: 100%;
		margin: 0;
		text-align: center;
	}

	.muted {
		color: var(--muted);
	}

	.open {
		padding: 14px 24px;
		border: 0;
		border-radius: 12px;
		background: var(--accent);
		color: #fff;
		font: inherit;
		font-weight: 600;
	}

	.error {
		position: absolute;
		inset: auto 16px 8px;
		margin: 0;
		padding: 10px 12px;
		border-radius: 8px;
		background: var(--surface);
		color: var(--danger);
		font-size: 0.9rem;
	}

	footer {
		border-top: 1px solid var(--border);
	}

	/* Keep the controls clear of the bottom quarter of a phone screen, where thumbs struggle. */
	@media (pointer: coarse) {
		footer {
			margin-bottom: max(25dvh, env(safe-area-inset-bottom));
		}
	}

	@media (pointer: fine) {
		footer {
			padding-bottom: env(safe-area-inset-bottom);
		}
	}

	.controls {
		display: flex;
		align-items: flex-end;
		max-width: 800px;
		margin: 0 auto;
		padding-left: 12px;
	}

	.speed {
		flex: 1;
		min-width: 0;
	}

	.play {
		display: grid;
		flex: none;
		place-items: center;
		width: 56px;
		height: 56px;
		margin-bottom: 26px;
		padding: 0;
		border: 0;
		border-radius: 50%;
		background: var(--accent);
		color: #fff;
	}

	.play svg {
		width: 26px;
		height: 26px;
		fill: currentColor;
	}

	.meta {
		max-width: 720px;
		margin: 0 auto;
		display: flex;
		justify-content: space-between;
		gap: 12px;
		padding: 8px 20px 4px;
		font-size: 0.78rem;
		color: var(--muted);
		font-variant-numeric: tabular-nums;
	}

	.chapter {
		overflow: hidden;
		white-space: nowrap;
		text-overflow: ellipsis;
	}

	.progress {
		width: calc(100% - 40px);
		max-width: 680px;
		height: 2px;
		margin: 0 auto;
		background: var(--track);
	}

	.progress div {
		height: 100%;
		background: var(--muted);
	}

	.scrim {
		position: fixed;
		inset: 0;
		background: var(--scrim);
	}

	.sheet {
		position: fixed;
		top: 0;
		bottom: 0;
		width: min(360px, 88vw);
		padding: calc(16px + env(safe-area-inset-top)) 16px calc(16px + env(safe-area-inset-bottom));
		overflow-y: auto;
		background: var(--surface);
		box-shadow: 0 0 24px rgb(0 0 0 / 0.15);
	}

	.sheet.toc {
		left: 0;
		padding-left: 4px;
		padding-right: 4px;
	}

	.sheet.settings {
		right: 0;
	}

	.close {
		position: absolute;
		top: calc(6px + env(safe-area-inset-top));
		right: 6px;
	}
</style>
