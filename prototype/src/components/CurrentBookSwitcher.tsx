import { CaretDown, FileArrowUp } from "@phosphor-icons/react";
import { useEffect, useRef, useState } from "react";
import type { LocalBook } from "../data/demoBooks";

type CurrentBookSwitcherProps = {
  currentBook: LocalBook | null;
  recentBooks: LocalBook[];
  onSelect: (id: string) => void;
  onImport: () => void;
};

export function CurrentBookSwitcher({
  currentBook,
  recentBooks,
  onSelect,
  onImport,
}: CurrentBookSwitcherProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

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
        {currentBook?.coverUrl ? (
          <img src={currentBook.coverUrl} alt="" />
        ) : (
          <span className="cover-fallback" aria-hidden="true">
            {currentBook?.title.slice(0, 1) ?? "书"}
          </span>
        )}
        <span className="book-switcher-copy">
          <strong>{currentBook?.title ?? "选择一本图书"}</strong>
          <small>
            {currentBook
              ? `${currentBook.format} · 已读 ${currentBook.progress}%`
              : "从本地导入 EPUB"}
          </small>
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
              key={book.id}
              className={book.id === currentBook?.id ? "is-current" : undefined}
              onClick={() => {
                onSelect(book.id);
                setOpen(false);
              }}
            >
              <span>{book.title}</span>
              <small>{book.progress}%</small>
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
