import { describe, expect, it } from "vitest";
import { DEMO_BOOKS } from "../data/demoBooks";
import {
  createImportedBook,
  filterAndSortBooks,
  parseLibraryState,
} from "./libraryStore";

describe("parseLibraryState", () => {
  it("returns null for malformed JSON", () => {
    expect(parseLibraryState("{")) .toBeNull();
  });

  it("returns null for an invalid book shape", () => {
    expect(parseLibraryState(JSON.stringify({ books: [{ id: 1 }], currentBookId: null }))).toBeNull();
  });
});

describe("filterAndSortBooks", () => {
  it("matches title and author", () => {
    const result = filterAndSortBooks(DEMO_BOOKS, {
      query: "费孝通",
      formatFilter: "ALL",
      sortBy: "LAST_READ_DESC",
    });
    expect(result.map((book) => book.id)).toEqual(["from-the-soil"]);
  });

  it("places unread books after recently read books", () => {
    const result = filterAndSortBooks(DEMO_BOOKS, {
      query: "",
      formatFilter: "ALL",
      sortBy: "LAST_READ_DESC",
    });
    expect(result.at(-1)?.id).toBe("1587");
  });
});

describe("createImportedBook", () => {
  it("rejects files other than EPUB", () => {
    expect(() => createImportedBook({ name: "notes.pdf" })).toThrow("当前原型仅支持 EPUB");
  });

  it("creates an EPUB record from the file name", () => {
    expect(createImportedBook({ name: "局外人.epub" }, "2026-06-18T00:00:00.000Z")).toMatchObject({
      id: "file-局外人-epub",
      title: "局外人",
      author: "未知作者",
      format: "EPUB",
      progress: 0,
    });
  });
});
