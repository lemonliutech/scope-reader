import { CaretDown, FileArrowUp } from "@phosphor-icons/react";
import { useEffect, useRef, useState } from "react";
import type { LibraryBook } from "../storage/schema";

type CurrentBookSwitcherProps = {
  currentBookId: string | null;
  books: LibraryBook[];
  onSelect: (id: string) => void;
  onImport: () => void;
};

export function CurrentBookSwitcher({ currentBookId, books, onSelect, onImport }: CurrentBookSwitcherProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const currentBook = books.find((b) => b.bookId === currentBookId) ?? null;
  const recentBooks = [...books]
    .sort((a, b) => (b.lastOpenedAt ?? "").localeCompare(a.lastOpenedAt ?? ""))
    .slice(0, 5);

  useEffect(() => {
    const close = (event: PointerEvent): void => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const escape = (event: KeyboardEvent): void => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", escape);
    };
  }, []);

  return (
    <div className="book-switcher" ref={rootRef}>
      <button
        type="button"
        className="book-switcher-trigger"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((value) => !value)}
      >
        <span className="book-switcher-copy">
          <strong>{currentBook?.metadata.title ?? "选择一本图书"}</strong>
          <small>{currentBook ? "EPUB" : "从本地导入 EPUB"}</small>
        </span>
        <CaretDown className="book-switcher-caret" size={16} />
      </button>
      {open && (
        <div className="book-switcher-menu" role="menu">
          <div className="book-switcher-menu-title">最近阅读</div>
          {recentBooks.map((book) => (
            <button
              role="menuitem"
              type="button"
              key={book.bookId}
              className={book.bookId === currentBookId ? "is-current" : undefined}
              onClick={() => {
                onSelect(book.bookId);
                setOpen(false);
              }}
            >
              <span>{book.metadata.title}</span>
            </button>
          ))}
          <button
            className="book-switcher-import"
            role="menuitem"
            type="button"
            onClick={() => {
              setOpen(false);
              onImport();
            }}
          >
            <FileArrowUp size={16} />导入图书
          </button>
        </div>
      )}
    </div>
  );
}
