import { X } from "@phosphor-icons/react";
import { useEffect, useRef, useState } from "react";
import type { ChangeEvent } from "react";
import { AppHeader } from "./components/AppHeader";
import { ConfirmDialog } from "./components/ConfirmDialog";
import { ImportError } from "./components/ImportError";
import { ImportStatus } from "./components/ImportStatus";
import type { ReaderPreferences } from "./domain/publication";
import { LibraryPage } from "./pages/LibraryPage";
import { ReaderPage } from "./pages/ReaderPage";
import { useReaderController } from "./services/useReaderController";
import { usePathname } from "./routing/usePathname";

const THEME_STORAGE_KEY = "scope-reader-theme";

function readInitialTheme(): ReaderPreferences["theme"] {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    if (stored === "DARK" || stored === "LIGHT") return stored;
  } catch {
    /* ignore */
  }
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "DARK" : "LIGHT";
}

export function App() {
  const controller = useReaderController();
  const { pathname, navigate } = usePathname();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [pendingDeleteBookId, setPendingDeleteBookId] = useState<string | null>(null);
  const [theme, setTheme] = useState<ReaderPreferences["theme"]>(readInitialTheme);

  const pendingDeleteBook = controller.books.find((b) => b.bookId === pendingDeleteBookId) ?? null;
  const currentBookId = controller.state.status === "ready" ? controller.state.bookId : null;
  const readerPreferences: ReaderPreferences = { fontSize: 16, lineHeight: 1.6, theme };

  const handleImport = (event: ChangeEvent<HTMLInputElement>): void => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    controller.importFile(file).then((ok) => { if (ok) navigate("/"); }).catch(() => {});
  };

  const handleSelectBook = (bookId: string): void => {
    controller.openBook(bookId).then(() => navigate("/")).catch(() => {});
  };

  const confirmDelete = (): void => {
    if (!pendingDeleteBookId) return;
    controller.deleteBook(pendingDeleteBookId).catch(() => {});
    setPendingDeleteBookId(null);
    navigate("/library");
  };

  const nonBlockingIssues = controller.issues.filter((i) => !i.blocking);

  useEffect(() => {
    document.documentElement.dataset.theme = theme === "DARK" ? "dark" : "light";
    try {
      localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {
      /* ignore */
    }
  }, [theme]);

  return (
    <>
      <AppHeader
        pathname={pathname}
        books={controller.books}
        currentBookId={currentBookId}
        onNavigate={navigate}
        onSelectBook={handleSelectBook}
        onImport={() => fileInputRef.current?.click()}
        onAbout={() => setAboutOpen(true)}
        theme={theme}
        onToggleTheme={() => setTheme((v) => (v === "DARK" ? "LIGHT" : "DARK"))}
      />
      <input
        ref={fileInputRef}
        className="visually-hidden"
        type="file"
        accept=".epub,application/epub+zip"
        onChange={handleImport}
      />
      {controller.state.status === "importing" && (
        <ImportStatus progress={controller.state.progress} />
      )}
      {controller.state.status === "error" && (
        <ImportError issues={controller.state.issues} onDismiss={controller.dismissIssues} />
      )}
      {nonBlockingIssues.length > 0 && controller.state.status !== "error" && (
        <ImportError issues={nonBlockingIssues} onDismiss={controller.dismissIssues} />
      )}
      {pathname === "/library" ? (
        <LibraryPage
          books={controller.books}
          booksLoaded={controller.booksLoaded}
          onOpen={(bookId) => {
            controller.openBook(bookId).then(() => navigate("/")).catch(() => {});
          }}
          onRequestDelete={setPendingDeleteBookId}
          onImport={() => fileInputRef.current?.click()}
        />
      ) : controller.state.status === "loading" ? (
        <main className="reader-empty">
          <p>正在加载…</p>
        </main>
      ) : (
        <ReaderPage
          publication={controller.state.status === "ready" ? controller.state.inspection : null}
          chapter={controller.state.status === "ready" ? controller.state.chapter : null}
          locator={controller.state.status === "ready" ? controller.state.location.locator : null}
          preferences={readerPreferences}
          temporary={controller.state.status === "ready" ? controller.state.temporary : false}
          onOpenTarget={controller.openTarget}
          onOpenLibrary={() => navigate("/library")}
          onImport={() => fileInputRef.current?.click()}
        />
      )}
      <ConfirmDialog
        book={pendingDeleteBook ? { title: pendingDeleteBook.metadata.title } : null}
        onCancel={() => setPendingDeleteBookId(null)}
        onConfirm={confirmDelete}
      />
      {aboutOpen && (
        <div className="dialog-backdrop" role="presentation" onMouseDown={() => setAboutOpen(false)}>
          <section
            className="dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="about-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <button type="button" className="dialog-close" onClick={() => setAboutOpen(false)} aria-label="关闭">
              <X size={20} />
            </button>
            <h2 id="about-title">关于 Scope</h2>
            <p>Scope 把本地图书渲染为自然滚动的内容网页。当前版本首先支持 EPUB，并保留切换其他解析引擎和图书格式的边界。</p>
            <button className="dialog-primary" type="button" onClick={() => setAboutOpen(false)}>知道了</button>
          </section>
        </div>
      )}
    </>
  );
}
