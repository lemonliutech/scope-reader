import { List, X } from "@phosphor-icons/react";
import { useState } from "react";
import { ChapterFrame } from "../components/ChapterFrame";
import type {
  ChapterDocument,
  NavigationNode,
  PublicationInspection,
  PublicationTarget,
  ReaderPreferences,
} from "../domain/publication";

const DEFAULT_PREFS: ReaderPreferences = { fontSize: 16, lineHeight: 1.6, theme: "LIGHT" };

type ReaderPageProps = {
  publication: PublicationInspection | null;
  chapter: ChapterDocument | null;
  temporary: boolean;
  onOpenTarget: (target: PublicationTarget) => void;
  onOpenLibrary: () => void;
};

type NavNodeProps = { node: NavigationNode; onSelect: (target: PublicationTarget) => void };

function NavNode({ node, onSelect }: NavNodeProps) {
  const [open, setOpen] = useState(true);
  const hasChildren = node.children.length > 0;
  return (
    <li className="tree-group">
      <button
        type="button"
        className={hasChildren ? "tree-parent" : "tree-link"}
        onClick={() => (hasChildren ? setOpen((v) => !v) : onSelect(node.target))}
        aria-expanded={hasChildren ? open : undefined}
      >
        {node.label}
      </button>
      {hasChildren && open && (
        <ul className="tree-children">
          {node.children.map((child) => (
            <NavNode key={child.id} node={child} onSelect={onSelect} />
          ))}
        </ul>
      )}
    </li>
  );
}

export function ReaderPage({ publication, chapter, temporary, onOpenTarget, onOpenLibrary }: ReaderPageProps) {
  const [outlineOpen, setOutlineOpen] = useState(false);

  if (!publication) {
    return (
      <main className="reader-empty">
        <h1>还没有打开图书</h1>
        <button type="button" onClick={onOpenLibrary}>前往图书管理</button>
      </main>
    );
  }

  const handleSelect = (target: PublicationTarget): void => {
    onOpenTarget(target);
    setOutlineOpen(false);
  };

  return (
    <>
      {temporary && (
        <div className="reader-notice" role="status">本次进度无法保存</div>
      )}
      <button className="mobile-outline-trigger" type="button" onClick={() => setOutlineOpen(true)}>
        <List size={18} />目录
      </button>
      <main id="top" className="reader-grid" data-testid="reader-grid">
        <article className="article" data-testid="article-column">
          {chapter ? (
            <ChapterFrame
              chapter={chapter}
              preferences={DEFAULT_PREFS}
              onDispose={() => {}}
              onExternalLink={(url) => window.open(url, "_blank", "noopener,noreferrer")}
            />
          ) : (
            <div className="chapter-placeholder">
              <p>请从目录中选择一章</p>
            </div>
          )}
        </article>
        <aside className={outlineOpen ? "outline is-open" : "outline"} data-testid="outline-column">
          <button
            className="drawer-close"
            type="button"
            onClick={() => setOutlineOpen(false)}
            aria-label="关闭目录"
          >
            <X size={20} />
          </button>
          <div className="book-meta">
            {publication.metadata.cover ? (
              <img
                src={URL.createObjectURL(publication.metadata.cover)}
                alt={`《${publication.metadata.title}》封面`}
              />
            ) : (
              <div className="cover-placeholder" aria-hidden="true">
                {publication.metadata.title.slice(0, 1)}
              </div>
            )}
            <div>
              <h2>{publication.metadata.title}</h2>
              <p>{publication.metadata.authors[0] ?? "未知作者"}</p>
            </div>
          </div>
          <div className="outline-heading">目录</div>
          <nav aria-label="本书章节">
            {publication.navigation.length > 0 ? (
              <ul className="chapter-tree">
                {publication.navigation.map((node) => (
                  <NavNode key={node.id} node={node} onSelect={handleSelect} />
                ))}
              </ul>
            ) : (
              <ul className="chapter-tree">
                {publication.readingOrder.map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      className="tree-link"
                      onClick={() => handleSelect(item.target)}
                    >
                      {item.label}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </nav>
        </aside>
      </main>
      {outlineOpen && (
        <button
          className="drawer-backdrop"
          type="button"
          aria-label="关闭目录"
          onClick={() => setOutlineOpen(false)}
        />
      )}
    </>
  );
}
