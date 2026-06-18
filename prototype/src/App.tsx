import { X } from "@phosphor-icons/react";
import { useRef, useState } from "react";
import type { ChangeEvent } from "react";
import { AppHeader } from "./components/AppHeader";
import { ConfirmDialog } from "./components/ConfirmDialog";
import { useLibrary } from "./library/useLibrary";
import { LibraryPage } from "./pages/LibraryPage";
import { ReaderPage } from "./pages/ReaderPage";
import { usePathname } from "./routing/usePathname";

export function App() {
  const library = useLibrary();
  const { pathname, navigate } = usePathname();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [pendingDeleteBookId, setPendingDeleteBookId] = useState<string | null>(null);
  const pendingDeleteBook =
    library.books.find((book) => book.id === pendingDeleteBookId) ?? null;

  const handleImport = (event: ChangeEvent<HTMLInputElement>): void => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      const book = library.importBook(file);
      setMessage(`已导入《${book.title}》`);
      navigate("/library");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "图书导入失败");
    }
  };

  const confirmDelete = (): void => {
    if (!pendingDeleteBook) return;
    library.removeBook(pendingDeleteBook.id);
    setMessage(`已删除《${pendingDeleteBook.title}》`);
    setPendingDeleteBookId(null);
    navigate("/library");
  };

  return (
    <>
      <AppHeader
        pathname={pathname}
        library={library}
        onNavigate={navigate}
        onImport={() => fileInputRef.current?.click()}
        onAbout={() => setAboutOpen(true)}
      />
      <input
        ref={fileInputRef}
        className="visually-hidden"
        type="file"
        accept=".epub,application/epub+zip"
        onChange={handleImport}
      />
      {pathname === "/library" ? (
        <LibraryPage
          library={library}
          onOpen={(id) => {
            library.selectBook(id);
            navigate("/");
          }}
          onRequestDelete={setPendingDeleteBookId}
          onImport={() => fileInputRef.current?.click()}
        />
      ) : (
        <ReaderPage currentBook={library.currentBook} onOpenLibrary={() => navigate("/library")} />
      )}
      {(message || library.notice) && (
        <div className="status-message" role="status" aria-live="polite">
          {message || library.notice}
        </div>
      )}
      <ConfirmDialog
        book={pendingDeleteBook}
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
