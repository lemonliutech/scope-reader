import { openDB, type IDBPDatabase } from "idb";
import { issue, ScopeException } from "../domain/scopeError";
import type {
  ImportRecord,
  LibraryBook,
  LibraryRepository,
  ScopeReaderDb,
  StoredBookBundle,
  StoredReadingState,
} from "./schema";

const DB_NAME = "scope-reader";
const DB_VERSION = 1;

export class IndexedDbLibraryRepository implements LibraryRepository {
  private dbPromise: Promise<IDBPDatabase<ScopeReaderDb>> | null = null;

  private getDb(): Promise<IDBPDatabase<ScopeReaderDb>> {
    if (this.dbPromise === null) {
      this.dbPromise = openDB<ScopeReaderDb>(DB_NAME, DB_VERSION, {
        upgrade(db) {
          db.createObjectStore("books", { keyPath: "bookId" });
          db.createObjectStore("publications", { keyPath: "bookId" });
          db.createObjectStore("readingStates", { keyPath: "bookId" });
          db.createObjectStore("preferences", { keyPath: "scope" });
        },
      }).catch((error) => {
        this.dbPromise = null;
        throw new ScopeException([
          issue("INDEXEDDB_UNAVAILABLE", "OPEN_DATABASE", true, {
            causeName: error instanceof Error ? error.name : String(error),
          }),
        ]);
      });
    }
    return this.dbPromise;
  }

  async importBook(input: ImportRecord): Promise<void> {
    const db = await this.getDb();

    // Check for duplicate SHA-256 in a separate readonly transaction to avoid
    // having to abort a write transaction (which emits unhandled rejections).
    try {
      const allBooks = await db.getAll("books");
      const duplicate = allBooks.find((b) => b.sha256 === input.book.sha256);
      if (duplicate !== undefined) {
        throw new ScopeException([
          issue("DUPLICATE_BOOK", "PERSIST_PUBLICATION", true, {
            existingBookId: duplicate.bookId,
          }),
        ]);
      }
    } catch (error) {
      if (error instanceof ScopeException) throw error;
      throw mapStorageError(error, "READ_DATABASE");
    }

    const tx = db.transaction(["books", "publications", "readingStates"], "readwrite");
    try {
      await tx.objectStore("books").put(input.book);
      await tx.objectStore("publications").put(input.publication);
      await tx.objectStore("readingStates").put(input.readingState);
      await tx.done;
    } catch (error) {
      throw mapStorageError(error, "WRITE_DATABASE");
    }
  }

  async listBooks(): Promise<LibraryBook[]> {
    const db = await this.getDb();
    try {
      const tx = db.transaction(["books", "publications", "readingStates"], "readonly");
      const [books, publications, readingStates] = await Promise.all([
        tx.objectStore("books").getAll(),
        tx.objectStore("publications").getAll(),
        tx.objectStore("readingStates").getAll(),
      ]);

      const publicationMap = new Map(publications.map((p) => [p.bookId, p]));
      const stateMap = new Map(readingStates.map((s) => [s.bookId, s]));

      return books.map((book) => {
        const pub = publicationMap.get(book.bookId);
        const state = stateMap.get(book.bookId);
        return {
          bookId: book.bookId,
          fileName: book.fileName,
          size: book.size,
          metadata: pub?.inspection.metadata ?? {
            title: book.fileName,
            authors: [],
            language: null,
            description: null,
            cover: null,
          },
          location: state?.location ?? { format: "EPUB", locator: "", chapterIndex: 0, scrollRatio: 0 },
          chapterCount: pub?.inspection.readingOrder.length ?? 0,
          importedAt: book.importedAt,
          lastOpenedAt: book.lastOpenedAt,
          temporary: false,
        };
      });
    } catch (error) {
      throw mapStorageError(error, "READ_DATABASE");
    }
  }

  async loadBook(bookId: string): Promise<StoredBookBundle | null> {
    const db = await this.getDb();
    try {
      const tx = db.transaction(["books", "publications", "readingStates", "preferences"], "readonly");
      const [book, publication, readingState, preferences] = await Promise.all([
        tx.objectStore("books").get(bookId),
        tx.objectStore("publications").get(bookId),
        tx.objectStore("readingStates").get(bookId),
        tx.objectStore("preferences").get("global"),
      ]);

      if (book === undefined || publication === undefined || readingState === undefined) {
        return null;
      }

      return { book, publication, readingState, preferences: preferences ?? null };
    } catch (error) {
      throw mapStorageError(error, "READ_DATABASE");
    }
  }

  async saveReadingState(state: StoredReadingState): Promise<void> {
    const db = await this.getDb();
    try {
      await db.put("readingStates", state);
    } catch (error) {
      throw mapStorageError(error, "WRITE_DATABASE");
    }
  }

  async touchLastOpened(bookId: string): Promise<void> {
    const db = await this.getDb();
    try {
      const book = await db.get("books", bookId);
      if (book) await db.put("books", { ...book, lastOpenedAt: new Date().toISOString() });
    } catch (error) {
      throw mapStorageError(error, "WRITE_DATABASE");
    }
  }

  async deleteBook(bookId: string): Promise<void> {
    const db = await this.getDb();
    const tx = db.transaction(["books", "publications", "readingStates"], "readwrite");
    try {
      await Promise.all([
        tx.objectStore("books").delete(bookId),
        tx.objectStore("publications").delete(bookId),
        tx.objectStore("readingStates").delete(bookId),
      ]);
      await tx.done;
    } catch (error) {
      throw mapStorageError(error, "DELETE_DATABASE");
    }
  }
}

function mapStorageError(
  error: unknown,
  stage: "READ_DATABASE" | "WRITE_DATABASE" | "DELETE_DATABASE",
): ScopeException {
  if (error instanceof ScopeException) return error;
  const name = error instanceof Error ? error.name : String(error);
  if (name === "QuotaExceededError") {
    return new ScopeException([issue("STORAGE_QUOTA_EXCEEDED", stage, true, { causeName: name })]);
  }
  if (name === "AbortError") {
    return new ScopeException([issue("STORAGE_TRANSACTION_ABORTED", stage, true, { causeName: name })]);
  }
  return new ScopeException([issue("BOOK_PERSIST_FAILED", stage, true, { causeName: name })]);
}
