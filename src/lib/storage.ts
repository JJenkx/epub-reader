// Books and the dictionary live in IndexedDB (localStorage caps out around 5 MB);
// small things like settings and reading positions live in localStorage.
// Nothing here is touched by app updates: the service worker only manages its own caches.

const DB = 'rsvp-reader';
const BOOKS = 'books';
const WORDS = 'dictionary';

let db: Promise<IDBDatabase> | undefined;

function open(): Promise<IDBDatabase> {
	db ??= new Promise((resolve, reject) => {
		const req = indexedDB.open(DB, 2);
		req.onupgradeneeded = () => {
			const d = req.result;
			if (!d.objectStoreNames.contains(BOOKS)) d.createObjectStore(BOOKS);
			if (!d.objectStoreNames.contains(WORDS)) d.createObjectStore(WORDS);
		};
		req.onsuccess = () => resolve(req.result);
		req.onerror = () => reject(req.error);
	});
	return db;
}

async function tx<T>(
	store: string,
	mode: IDBTransactionMode,
	fn: (store: IDBObjectStore) => IDBRequest<T>
): Promise<T> {
	const d = await open();
	return new Promise((resolve, reject) => {
		const req = fn(d.transaction(store, mode).objectStore(store));
		req.onsuccess = () => resolve(req.result);
		req.onerror = () => reject(req.error);
	});
}

export interface StoredBook {
	id: string;
	name: string;
	title: string;
	data: Blob;
	added: number;
	opened: number;
}

/** A book's identity: same file name and size means the same book, so positions carry over. */
export const bookId = (name: string, size: number) => `${name}:${size}`;

export const putBook = (book: StoredBook) => tx(BOOKS, 'readwrite', (s) => s.put(book, book.id));
export const getBook = (id: string) => tx<StoredBook | undefined>(BOOKS, 'readonly', (s) => s.get(id));
export const deleteBook = (id: string) => tx(BOOKS, 'readwrite', (s) => s.delete(id));

export async function listBooks(): Promise<StoredBook[]> {
	// Before the library existed, the one book was stored under the key "current".
	const legacy = await tx<{ name: string; data: Blob } | undefined>(BOOKS, 'readonly', (s) =>
		s.get('current')
	);
	if (legacy && !('id' in legacy)) {
		const id = bookId(legacy.name, legacy.data.size);
		const now = Date.now();
		await putBook({ id, name: legacy.name, title: legacy.name, data: legacy.data, added: now, opened: now });
		await tx(BOOKS, 'readwrite', (s) => s.delete('current'));
		setJSON('rsvp-current', id);
	}
	return tx<StoredBook[]>(BOOKS, 'readonly', (s) => s.getAll());
}

export interface DictionaryEntry {
	word: string;
	phonetic?: string;
	meanings: { partOfSpeech: string; definitions: string[] }[];
	/** The sentence the word was looked up from, and its book. */
	context?: string;
	book?: string;
	added: number;
}

export const putEntry = (entry: DictionaryEntry) => tx(WORDS, 'readwrite', (s) => s.put(entry, entry.word));
export const getEntry = (word: string) =>
	tx<DictionaryEntry | undefined>(WORDS, 'readonly', (s) => s.get(word));
export const deleteEntry = (word: string) => tx(WORDS, 'readwrite', (s) => s.delete(word));
export const listEntries = () => tx<DictionaryEntry[]>(WORDS, 'readonly', (s) => s.getAll());

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

export function removeKey(key: string) {
	try {
		localStorage.removeItem(key);
	} catch {
		// Ignore.
	}
}
