// The EPUB itself lives in IndexedDB (localStorage caps out around 5 MB);
// small things like settings and reading position live in localStorage.

const DB = 'rsvp-reader';
const STORE = 'books';

function open(): Promise<IDBDatabase> {
	return new Promise((resolve, reject) => {
		const req = indexedDB.open(DB, 1);
		req.onupgradeneeded = () => req.result.createObjectStore(STORE);
		req.onsuccess = () => resolve(req.result);
		req.onerror = () => reject(req.error);
	});
}

async function tx<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
	const db = await open();
	return new Promise((resolve, reject) => {
		const req = fn(db.transaction(STORE, mode).objectStore(STORE));
		req.onsuccess = () => resolve(req.result);
		req.onerror = () => reject(req.error);
	});
}

export interface StoredBook {
	name: string;
	data: Blob;
}

export const saveBook = (book: StoredBook) => tx('readwrite', (s) => s.put(book, 'current'));
export const loadBook = () => tx<StoredBook | undefined>('readonly', (s) => s.get('current'));
export const clearBook = () => tx('readwrite', (s) => s.delete('current'));

export function getJSON<T>(key: string, fallback: T): T {
	try {
		const raw = localStorage.getItem(key);
		return raw === null ? fallback : (JSON.parse(raw) as T);
	} catch {
		return fallback;
	}
}

export function setJSON(key: string, value: unknown) {
	try {
		localStorage.setItem(key, JSON.stringify(value));
	} catch {
		// Storage full or blocked; nothing useful to do.
	}
}
