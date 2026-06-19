import type { LibraryBook } from "../storage/schema";
import { CurrentBookSwitcher } from "./CurrentBookSwitcher";

type AppHeaderProps = {
  pathname: string;
  books: LibraryBook[];
  currentBookId: string | null;
  onNavigate: (path: string) => void;
  onSelectBook: (bookId: string) => void;
  onImport: () => void;
  onAbout: () => void;
};

export function AppHeader({ pathname, books, currentBookId, onNavigate, onSelectBook, onImport, onAbout }: AppHeaderProps) {
  return (
    <header className="topbar">
      <div className="topbar-inner">
        <button className="brand" type="button" onClick={() => onNavigate("/")}>
          Scope
        </button>
        <CurrentBookSwitcher
          currentBookId={currentBookId}
          books={books}
          onSelect={onSelectBook}
          onImport={onImport}
        />
        <nav className="top-actions" aria-label="页面操作">
          <button
            type="button"
            aria-current={pathname === "/library" ? "page" : undefined}
            onClick={() => onNavigate("/library")}
          >
            图书管理
          </button>
          <button type="button" onClick={onAbout}>关于</button>
        </nav>
      </div>
    </header>
  );
}
