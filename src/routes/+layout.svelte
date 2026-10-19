<script lang="ts">
	import favicon from '#lib/assets/favicon.svg';
	import type { LayoutProps } from './$types';

	let { children }: LayoutProps = $props();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

{@render children()}

<style>
	:global {
		:root {
			--bg: #f7f5f0;
			--surface: #ffffff;
			--text: #1f1f1f;
			--muted: #7a766e;
			--border: #e2ded5;
			--track: #ebe7de;
			--track-fill: #ddd8cc;
			--accent: #d9472f;
			--accent-soft: #f2c9bf;
			--highlight: #fbe3a6;
			--guide: #d6d1c6;
			--danger: #b3261e;
			--scrim: rgb(0 0 0 / 0.3);
			--word-font: ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
			--page-font: Charter, 'Iowan Old Style', Georgia, 'Times New Roman', serif;
			color-scheme: light;
		}

		@media (prefers-color-scheme: dark) {
			:root:not([data-theme='light']) {
				--bg: #141414;
				--surface: #1e1e1e;
				--text: #e8e6e1;
				--muted: #8f8b84;
				--border: #2e2e2e;
				--track: #242424;
				--track-fill: #333;
				--accent: #f06a4f;
				--accent-soft: #5a2a20;
				--highlight: #5a4a1e;
				--guide: #3a3a3a;
				--danger: #f2817a;
				--scrim: rgb(0 0 0 / 0.55);
				color-scheme: dark;
			}
		}

		:root[data-theme='dark'] {
			--bg: #141414;
			--surface: #1e1e1e;
			--text: #e8e6e1;
			--muted: #8f8b84;
			--border: #2e2e2e;
			--track: #242424;
			--track-fill: #333;
			--accent: #f06a4f;
			--accent-soft: #5a2a20;
			--highlight: #5a4a1e;
			--guide: #3a3a3a;
			--danger: #f2817a;
			--scrim: rgb(0 0 0 / 0.55);
			color-scheme: dark;
		}

		*,
		*::before,
		*::after {
			box-sizing: border-box;
		}

		html,
		body {
			margin: 0;
			height: 100%;
			background: var(--bg);
			color: var(--text);
			font-family: var(--word-font);
			overscroll-behavior: none;
			-webkit-tap-highlight-color: transparent;
		}

		button {
			cursor: pointer;
		}
	}
</style>
