import { Moon, Sun } from "@phosphor-icons/react";
import type { ReaderPreferences } from "../domain/publication";
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
  theme: ReaderPreferences["theme"];
  onToggleTheme: () => void;
};

export function AppHeader({
  pathname,
  books,
  currentBookId,
  onNavigate,
  onSelectBook,
  onImport,
  onAbout,
  theme,
  onToggleTheme,
}: AppHeaderProps) {
  const themeLabel = theme === "DARK" ? "切换到浅色主题" : "切换到深色主题";

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
          <button
            className="top-icon-button"
            type="button"
            onClick={onToggleTheme}
            aria-label={themeLabel}
            title={themeLabel}
          >
            {theme === "DARK" ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          <button type="button" onClick={onAbout}>关于</button>
        </nav>
      </div>
    </header>
  );
}
