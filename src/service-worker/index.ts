/// <reference no-default-lib="true"/>
/// <reference lib="esnext" />
/// <reference lib="webworker" />
import { self } from '$app/service-worker';
import { version } from '$app/env';
import { assets, immutable, prerendered } from '$app/manifest';
import { resolve } from '$app/paths';

// Only Cache Storage entries named here are ever deleted. Books, settings, positions and the
// dictionary live in IndexedDB and localStorage, which updates never touch.
const PREFIX = 'read-app-';
const CACHE = PREFIX + version;

const ASSETS = [
	...immutable.map((a) => resolve(a.path)),
	...assets.map((a) => resolve(a.path)),
	...prerendered.map((p) => resolve(p.path))
];
const SHELL = resolve('/');

self.addEventListener('install', (event) => {
	// Take over as soon as the new version is cached; the page then reloads onto it.
	event.waitUntil(
		caches
			.open(CACHE)
			.then((cache) => cache.addAll(ASSETS))
			.then(() => self.skipWaiting())
	);
});

self.addEventListener('activate', (event) => {
	event.waitUntil(
		(async () => {
			for (const key of await caches.keys()) {
				if (key.startsWith(PREFIX) && key !== CACHE) await caches.delete(key);
			}
			await self.clients.claim();
		})()
	);
});

self.addEventListener('fetch', (event) => {
	const { request } = event;
	const url = new URL(request.url);
	// Leave other origins (the dictionary API) and non-GET requests to the network.
	if (request.method !== 'GET' || url.origin !== self.location.origin) return;

	event.respondWith(
		(async () => {
			const cache = await caches.open(CACHE);
			if (ASSETS.includes(url.pathname)) {
				const hit = await cache.match(url.pathname);
				if (hit) return hit;
			}
			try {
				return await fetch(request);
			} catch (error) {
				// Offline: serve the cached file, or the app shell for page navigations.
				const hit =
					(await cache.match(request)) ??
					(request.mode === 'navigate' ? await cache.match(SHELL) : undefined);
				if (hit) return hit;
				throw error;
			}
		})()
	);
});
