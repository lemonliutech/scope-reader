import { CurrentBookSwitcher } from "./CurrentBookSwitcher";
import type { LibraryController } from "../library/useLibrary";

type AppHeaderProps = {
  pathname: string;
  library: LibraryController;
  onNavigate: (path: string) => void;
  onImport: () => void;
  onAbout: () => void;
};

export function AppHeader({
  pathname,
  library,
  onNavigate,
  onImport,
  onAbout,
}: AppHeaderProps) {
  const recentBooks = [...library.books]
    .sort((a, b) => (b.lastReadAt ?? "").localeCompare(a.lastReadAt ?? ""))
    .slice(0, 5);

  return (
    <header className="topbar">
      <div className="topbar-inner">
        <button className="brand" type="button" onClick={() => onNavigate("/")}>
          Scope
        </button>
        <CurrentBookSwitcher
          currentBook={library.currentBook}
          recentBooks={recentBooks}
          onSelect={(id) => {
            library.selectBook(id);
            onNavigate("/");
          }}
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
