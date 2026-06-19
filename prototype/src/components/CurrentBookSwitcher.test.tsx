import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import type { LibraryBook } from "../storage/schema";
import { CurrentBookSwitcher } from "./CurrentBookSwitcher";

function makeBook(bookId: string, title: string, author: string): LibraryBook {
  return {
    bookId,
    fileName: `${bookId}.epub`,
    size: 1000,
    metadata: { title, authors: [author], language: null, description: null, cover: null },
    location: { format: "EPUB", locator: "", chapterIndex: 0, scrollRatio: 0 },
    chapterCount: 0,
    importedAt: "2026-06-16T08:00:00.000Z",
    lastOpenedAt: "2026-06-18T00:00:00.000Z",
    temporary: false,
  };
}

const books: LibraryBook[] = [
  makeBook("sapiens", "人类简史", "尤瓦尔·赫拉利"),
  makeBook("from-the-soil", "乡土中国", "费孝通"),
];

it("opens recent books and selects one", () => {
  const onSelect = vi.fn();
  render(
    <CurrentBookSwitcher
      currentBookId="sapiens"
      books={books}
      onSelect={onSelect}
      onImport={vi.fn()}
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: /人类简史/ }));
  fireEvent.click(screen.getByRole("menuitem", { name: /乡土中国/ }));
  expect(onSelect).toHaveBeenCalledWith("from-the-soil");
  expect(screen.queryByRole("menu")).not.toBeInTheDocument();
});
