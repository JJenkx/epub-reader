import { getJSON, setJSON } from './storage';

interface BeforeInstallPromptEvent extends Event {
	prompt(): Promise<void>;
	userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const DISMISSED = 'rsvp-install-dismissed';

class Pwa {
	/** The browser offered an install prompt we can trigger. */
	canInstall = $state(false);
	/** iOS can't prompt; it needs Share → Add to Home Screen. */
	iosHint = $state(false);
	dismissed = $state(getJSON(DISMISSED, false));

	#prompt: BeforeInstallPromptEvent | null = null;

	/** `busy` reports whether reloading now would interrupt reading. */
	init(busy: () => boolean) {
		const standalone =
			matchMedia('(display-mode: standalone)').matches ||
			(navigator as Navigator & { standalone?: boolean }).standalone === true;

		if (!standalone) {
			addEventListener('beforeinstallprompt', (e) => {
				e.preventDefault();
				this.#prompt = e as BeforeInstallPromptEvent;
				this.canInstall = true;
			});
			const ios =
				/iphone|ipad|ipod/i.test(navigator.userAgent) ||
				(navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
			this.iosHint = ios;
		}
		addEventListener('appinstalled', () => {
			this.canInstall = false;
			this.#prompt = null;
		});

		// Ask the browser not to evict stored books and words under storage pressure.
		void navigator.storage?.persist?.();

		if (!('serviceWorker' in navigator)) return;
		// The new service worker takes over as soon as it installs; reload onto the new version
		// then, unless that would interrupt reading. Stored data is untouched by this.
		let controlled = !!navigator.serviceWorker.controller;
		navigator.serviceWorker.addEventListener('controllerchange', () => {
			if (!controlled) {
				controlled = true; // First install, not an update.
				return;
			}
			const reload = () => (busy() ? setTimeout(reload, 1000) : location.reload());
			reload();
		});
		const check = () => navigator.serviceWorker.getRegistration().then((r) => r?.update());
		document.addEventListener('visibilitychange', () => {
			if (!document.hidden) void check();
		});
		setInterval(check, 30 * 60 * 1000);
	}

	async install() {
		const prompt = this.#prompt;
		if (!prompt) return;
		await prompt.prompt();
		await prompt.userChoice;
		this.#prompt = null;
		this.canInstall = false;
	}

	dismiss() {
		this.dismissed = true;
		setJSON(DISMISSED, true);
	}
}

export const pwa = new Pwa();
