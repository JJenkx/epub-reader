import { parseEpub, type Book } from './epub';
import { reader } from './reader.svelte';
import {
	bookId,
	deleteBook,
	getBook,
	getJSON,
	listBooks,
	putBook,
	removeKey,
	setJSON,
	type StoredBook
} from './storage';

export type BookInfo = Omit<StoredBook, 'data'> & { progress: number | null };

const CURRENT = 'rsvp-current';
/** How many parsed books to keep in memory for instant switching. */
const KEEP_PARSED = 3;

class Library {
	books = $state<BookInfo[]>([]);
	currentId = $state<string | null>(null);

	#parsed = new Map<string, Book>();

	async init() {
		this.#refresh(await listBooks());
		const id = getJSON<string | null>(CURRENT, null);
		const target = this.books.find((b) => b.id === id) ?? this.books[0];
		if (target) await this.open(target.id);
	}

	async add(file: File) {
		const id = bookId(file.name, file.size);
		const book = await this.#parse(id, file);
		const existing = this.books.find((b) => b.id === id);
		const now = Date.now();
		await putBook({
			id,
			name: file.name,
			title: book.title,
			data: file,
			added: existing?.added ?? now,
			opened: now
		});
		this.#show(id, book);
		this.#refresh(await listBooks());
	}

	async open(id: string) {
		if (id === this.currentId && reader.book) return;
		const stored = await getBook(id);
		if (!stored) throw new Error('That book is no longer stored');
		const book = this.#parsed.get(id) ?? (await this.#parse(id, stored.data));
		this.#show(id, book);
		await putBook({ ...stored, title: book.title, opened: Date.now() });
		this.#refresh(await listBooks());
	}

	async remove(id: string) {
		await deleteBook(id);
		removeKey(`rsvp-pos:${id}`);
		removeKey(`rsvp-len:${id}`);
		this.#parsed.get(id)?.dispose();
		this.#parsed.delete(id);
		const rest = await listBooks();
		this.#refresh(rest);
		if (id === this.currentId) {
			reader.close();
			this.currentId = null;
			removeKey(CURRENT);
			if (this.books[0]) await this.open(this.books[0].id);
		}
	}

	/** Refresh progress figures, e.g. after reading. */
	touch() {
		this.books = this.books.map((b) => ({ ...b, progress: progressOf(b.id) }));
	}

	async #parse(id: string, data: Blob) {
		const book = await parseEpub(data);
		this.#parsed.delete(id);
		this.#parsed.set(id, book);
		// Drop the least recently used parsed books (never the one being read).
		for (const [key, old] of this.#parsed) {
			if (this.#parsed.size <= KEEP_PARSED) break;
			if (key === this.currentId) continue;
			old.dispose();
			this.#parsed.delete(key);
		}
		return book;
	}

	#show(id: string, book: Book) {
		this.#parsed.delete(id);
		this.#parsed.set(id, book);
		reader.open(book, id);
		setJSON(`rsvp-len:${id}`, book.tokens.length);
		setJSON(CURRENT, id);
		this.currentId = id;
		document.title = book.title;
	}

	#refresh(stored: StoredBook[]) {
		this.books = stored
			.map(({ data: _data, ...info }) => ({ ...info, progress: progressOf(info.id) }))
			.sort((a, b) => b.opened - a.opened);
	}
}

function progressOf(id: string) {
	const length = getJSON<number | null>(`rsvp-len:${id}`, null);
	if (!length) return null;
	return Math.min(1, getJSON(`rsvp-pos:${id}`, 0) / Math.max(1, length - 1));
}

export const library = new Library();
