<script lang="ts">
	import Books from '#lib/Books.svelte';
	import Dictionary from '#lib/Dictionary.svelte';
	import { library } from '#lib/library.svelte.ts';
	import PageView from '#lib/PageView.svelte';
	import { pwa } from '#lib/pwa.svelte.ts';
	import { reader } from '#lib/reader.svelte.ts';
	import SettingsPanel from '#lib/SettingsPanel.svelte';
	import { settings } from '#lib/settings.svelte.ts';
	import SpeedBar from '#lib/SpeedBar.svelte';
	import Toc from '#lib/Toc.svelte';
	import WordDisplay from '#lib/WordDisplay.svelte';

	type Panel = 'books' | 'toc' | 'settings' | 'dictionary';

	let status = $state<'loading' | 'empty' | 'ready'>('loading');
	let error = $state('');
	let panel = $state<Panel | null>(null);
	let pageView = $state(false);
	let fileInput: HTMLInputElement | undefined = $state();
	/** The word and sentence the dictionary was opened on. */
	let lookup = $state({ word: '', sentence: '' });

	async function init() {
		try {
			await library.init();
		} catch (e) {
			error = `Couldn't reopen your books: ${(e as Error).message}`;
		}
		status = reader.book ? 'ready' : 'empty';
	}

	init();
	pwa.init(() => reader.playing);

	async function onfile(e: Event & { currentTarget: HTMLInputElement }) {
		const file = e.currentTarget.files?.[0];
		e.currentTarget.value = '';
		if (!file) return;
		panel = null;
		error = '';
		status = 'loading';
		try {
			await library.add(file);
			pageView = false;
		} catch (err) {
			error = `Couldn't open ${file.name}: ${(err as Error).message}`;
		}
		status = reader.book ? 'ready' : 'empty';
	}

	let pageTimer: ReturnType<typeof setTimeout> | undefined;

	function openPanel(which: Panel) {
		if (reader.playing) {
			reader.stop();
			paused(0);
		}
		if (which === 'dictionary') {
			const token = reader.token;
			const word = token && 'w' in token ? (token.h ? token.h.parts.join('') : token.w) : '';
			lookup = { word, sentence: reader.sentenceAt(reader.index) };
		}
		panel = which;
	}

	function closePanel() {
		panel = null;
		status = reader.book ? 'ready' : 'empty';
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
</script>

<svelte:window onpagehide={() => reader.save()} />
<svelte:document
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
			<button class="icon" aria-label="Books" onclick={() => openPanel('books')}>
				<svg viewBox="0 0 24 24"><path d="M5 4h4v16H5zM10 4h4v16h-4zM15.5 4.6l3.8-1 3.7 15.5-3.9.9z" /></svg>
			</button>
			{#if status === 'ready'}
				<button class="icon" aria-label="Table of contents" onclick={() => openPanel('toc')}>
					<svg viewBox="0 0 24 24"><path d="M4 6h16M4 12h16M4 18h10" /></svg>
				</button>
				<span class="title">{reader.book?.title}</span>
			{/if}
		</div>
		<div class="right">
			{#if status === 'ready'}
				<button class="icon" aria-label="Dictionary" onclick={() => openPanel('dictionary')}>
					<svg viewBox="0 0 24 24"><path d="M5 4.5A1.5 1.5 0 0 1 6.5 3H19v15H6.5A1.5 1.5 0 0 0 5 19.5zM5 19.5A1.5 1.5 0 0 0 6.5 21H19v-3M9 7.5h6M9 10.5h4" /></svg>
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

	{#if !pwa.dismissed && (pwa.canInstall || pwa.iosHint)}
		<div class="install" role="status">
			{#if pwa.canInstall}
				<span>Install Read as an app: it opens full screen and works offline.</span>
				<button class="primary" onclick={() => pwa.install()}>Install</button>
			{:else}
				<span>To install, tap Share, then “Add to Home Screen”.</span>
			{/if}
			<button aria-label="Dismiss" onclick={() => pwa.dismiss()}>Not now</button>
		</div>
	{/if}

	<main>
		{#if status === 'loading'}
			<p class="center muted">Loading…</p>
		{:else if status === 'empty'}
			<div class="center">
				<button class="open" onclick={() => fileInput?.click()}>Open an EPUB</button>
				<p class="muted">Your books stay on this device.</p>
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
			<SpeedBar onpress={showRsvp} onpause={() => paused()} />
		</footer>
		<div class="dock">
			<button class="rewind" aria-label="Rewind" onclick={() => reader.back()}>
				<svg viewBox="0 0 24 24"><path d="M11 7.5v9a.8.8 0 0 1-1.3.6L4 12.6a.8.8 0 0 1 0-1.2l5.7-4.5a.8.8 0 0 1 1.3.6zM20 7.5v9a.8.8 0 0 1-1.3.6L13 12.6a.8.8 0 0 1 0-1.2l5.7-4.5a.8.8 0 0 1 1.3.6z" /></svg>
			</button>
			<button class="play" aria-label={reader.continuous ? 'Pause' : 'Play'} onclick={togglePlay}>
				{#if reader.continuous}
					<svg viewBox="0 0 24 24"><rect x="6" y="5" width="4" height="14" rx="1" /><rect x="14" y="5" width="4" height="14" rx="1" /></svg>
				{:else}
					<svg viewBox="0 0 24 24"><path d="M8 5.5v13a1 1 0 0 0 1.5.9l10.4-6.5a1 1 0 0 0 0-1.8L9.5 4.6A1 1 0 0 0 8 5.5z" /></svg>
				{/if}
			</button>
		</div>
	{/if}
</div>

{#if panel}
	<div class="scrim" role="presentation" onclick={closePanel}></div>
	<aside class={['sheet', panel === 'books' || panel === 'toc' ? 'from-left' : 'from-right']}>
		<button class="icon close" aria-label="Close" onclick={closePanel}>
			<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18" /></svg>
		</button>
		{#if panel === 'books'}
			<Books onadd={() => fileInput?.click()} onclose={closePanel} />
		{:else if panel === 'toc'}
			<Toc onclose={closePanel} />
		{:else if panel === 'dictionary'}
			<Dictionary
				word={lookup.word}
				context={{ sentence: lookup.sentence, book: reader.book?.title ?? '' }}
			/>
		{:else}
			<SettingsPanel />
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

	/* The title gives way to the buttons, never the other way round. */
	.left {
		flex: 1;
		gap: 2px;
	}

	.right {
		flex: none;
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

	/* Big, easy-to-hit controls. On phones they fill the bottom quarter of the screen:
	   rewind on the left quarter, play/pause on the rest. */
	.dock {
		display: flex;
		gap: 8px;
		width: calc(100% - 24px);
		max-width: 800px;
		height: 64px;
		margin: 4px auto calc(12px + env(safe-area-inset-bottom));
	}

	@media (pointer: coarse) {
		.dock {
			height: calc(25dvh - 16px - env(safe-area-inset-bottom));
			min-height: 88px;
		}
	}

	.dock button {
		display: grid;
		place-items: center;
		padding: 0;
		border: 0;
		border-radius: 18px;
		background: var(--track);
		color: var(--muted);
		touch-action: manipulation;
		user-select: none;
		-webkit-user-select: none;
	}

	.dock button:active {
		background: var(--track-fill);
	}

	.rewind {
		flex: 1;
	}

	.play {
		flex: 3;
	}

	.dock svg {
		width: 40px;
		height: 40px;
		fill: currentColor;
	}

	.rewind svg {
		width: 32px;
		height: 32px;
	}

	.install {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 8px;
		margin: 0 12px 4px;
		padding: 10px 12px;
		border-radius: 12px;
		background: var(--track);
		font-size: 0.85rem;
	}

	.install span {
		flex: 1 1 180px;
	}

	.install button {
		padding: 7px 12px;
		border: 1px solid var(--border);
		border-radius: 8px;
		background: none;
		color: var(--text);
		font: inherit;
	}

	.install .primary {
		border-color: var(--accent);
		background: var(--accent);
		color: #fff;
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

	.sheet.from-left {
		left: 0;
		padding-left: 4px;
		padding-right: 4px;
	}

	.sheet.from-right {
		right: 0;
	}

	.close {
		position: absolute;
		top: calc(6px + env(safe-area-inset-top));
		right: 6px;
	}
</style>
