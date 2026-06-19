import "fake-indexeddb/auto";
import { IDBFactory } from "fake-indexeddb";
import { beforeEach, describe, expect, it } from "vitest";
import type { BookMetadata, PublicationInspection, PublicationLocation } from "../domain/publication";
import { ScopeException } from "../domain/scopeError";
import { IndexedDbLibraryRepository } from "./IndexedDbLibraryRepository";
import type { ImportRecord, StoredBook, StoredPublication, StoredReadingState } from "./schema";

// Provide a fresh IndexedDB instance before each test for isolation.
beforeEach(() => {
  globalThis.indexedDB = new IDBFactory();
});

function makeBook(bookId = "book-1", sha256 = "abc123"): StoredBook {
  return {
    bookId,
    sha256,
    blob: new Blob(["epub-bytes"]),
    fileName: "test.epub",
    size: 10,
    importedAt: new Date().toISOString(),
    lastOpenedAt: null,
  };
}

function makeInspection(): PublicationInspection {
  const metadata: BookMetadata = {
    title: "Test Book",
    authors: ["Author"],
    language: "en",
    description: null,
    cover: null,
  };
  return { metadata, navigation: [], readingOrder: [], issues: [] };
}

function makePublication(bookId = "book-1"): StoredPublication {
  return { bookId, format: "EPUB", engineVersion: "0.3.93", inspection: makeInspection() };
}

function makeLocation(): PublicationLocation {
  return { format: "EPUB", locator: "chapter.xhtml", chapterIndex: 0, scrollRatio: 0 };
}

function makeState(bookId = "book-1"): StoredReadingState {
  return { bookId, location: makeLocation(), updatedAt: new Date().toISOString() };
}

function makeRecord(bookId = "book-1", sha256 = "abc123"): ImportRecord {
  return { book: makeBook(bookId, sha256), publication: makePublication(bookId), readingState: makeState(bookId) };
}

describe("IndexedDbLibraryRepository", () => {
  it("importBook writes book, publication, and readingState atomically", async () => {
    const repo = new IndexedDbLibraryRepository();
    await repo.importBook(makeRecord());

    const bundle = await repo.loadBook("book-1");
    expect(bundle).not.toBeNull();
    expect(bundle!.book.bookId).toBe("book-1");
    expect(bundle!.publication.engineVersion).toBe("0.3.93");
    expect(bundle!.readingState.location.locator).toBe("chapter.xhtml");
    expect(bundle!.preferences).toBeNull();
  });

  it("importBook throws DUPLICATE_BOOK when sha256 already exists", async () => {
    const repo = new IndexedDbLibraryRepository();
    await repo.importBook(makeRecord("book-1", "sha-dupe"));

    await expect(repo.importBook(makeRecord("book-2", "sha-dupe"))).rejects.toSatisfy(
      (err: unknown) =>
        err instanceof ScopeException &&
        err.issues.some((i) => i.code === "DUPLICATE_BOOK"),
    );
  });

  it("DUPLICATE_BOOK does not overwrite existing reading state", async () => {
    const repo = new IndexedDbLibraryRepository();
    await repo.importBook(makeRecord("book-1", "sha-dup"));

    try {
      await repo.importBook(makeRecord("book-2", "sha-dup"));
    } catch {
      // expected duplicate error
    }

    const books = await repo.listBooks();
    expect(books).toHaveLength(1);
    expect(books[0]!.bookId).toBe("book-1");
  });

  it("deleteBook removes book, publication, and readingState", async () => {
    const repo = new IndexedDbLibraryRepository();
    await repo.importBook(makeRecord());

    await repo.deleteBook("book-1");

    const bundle = await repo.loadBook("book-1");
    expect(bundle).toBeNull();

    const books = await repo.listBooks();
    expect(books).toHaveLength(0);
  });

  it("saveReadingState updates the stored location", async () => {
    const repo = new IndexedDbLibraryRepository();
    await repo.importBook(makeRecord());

    const updated: StoredReadingState = {
      bookId: "book-1",
      location: { format: "EPUB", locator: "chapter2.xhtml", chapterIndex: 1, scrollRatio: 0.5 },
      updatedAt: new Date().toISOString(),
    };
    await repo.saveReadingState(updated);

    const bundle = await repo.loadBook("book-1");
    expect(bundle!.readingState.location.locator).toBe("chapter2.xhtml");
    expect(bundle!.readingState.location.scrollRatio).toBe(0.5);
  });

  it("listBooks returns LibraryBook with metadata and location", async () => {
    const repo = new IndexedDbLibraryRepository();
    await repo.importBook(makeRecord());

    const books = await repo.listBooks();
    expect(books).toHaveLength(1);
    expect(books[0]!.fileName).toBe("test.epub");
    expect(books[0]!.metadata.title).toBe("Test Book");
    expect(books[0]!.location.locator).toBe("chapter.xhtml");
    expect(books[0]!.temporary).toBe(false);
  });
});
