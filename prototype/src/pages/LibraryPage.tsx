import { FileArrowUp, MagnifyingGlass, Trash } from "@phosphor-icons/react";
import { useMemo, useState } from "react";
import type { LibraryBook } from "../storage/schema";

type FormatFilter = "ALL" | "EPUB";
type SortBy = "LAST_READ_DESC" | "IMPORTED_DESC" | "TITLE_ASC";

type LibraryPageProps = {
  books: LibraryBook[];
  onOpen: (bookId: string) => void;
  onRequestDelete: (bookId: string) => void;
  onImport: () => void;
};

function filterAndSort(books: readonly LibraryBook[], query: string, formatFilter: FormatFilter, sortBy: SortBy): LibraryBook[] {
  const q = query.trim().toLocaleLowerCase("zh-CN");
  const filtered = books.filter((book) => {
    const haystack = `${book.metadata.title} ${book.metadata.authors[0] ?? ""}`.toLocaleLowerCase("zh-CN");
    const matchesQuery = !q || haystack.includes(q);
    const matchesFormat = formatFilter === "ALL" || true;
    return matchesQuery && matchesFormat;
  });

  return [...filtered].sort((a, b) => {
    if (sortBy === "TITLE_ASC") return a.metadata.title.localeCompare(b.metadata.title, "zh-CN");
    if (sortBy === "IMPORTED_DESC") return b.importedAt.localeCompare(a.importedAt);
    if (a.lastOpenedAt && b.lastOpenedAt) return b.lastOpenedAt.localeCompare(a.lastOpenedAt);
    if (a.lastOpenedAt) return -1;
    if (b.lastOpenedAt) return 1;
    return b.importedAt.localeCompare(a.importedAt);
  });
}

function readLabel(value: string | null): string {
  if (!value) return "未开始";
  return new Intl.DateTimeFormat("zh-CN", { month: "short", day: "numeric" }).format(new Date(value));
}

export function LibraryPage({ books, onOpen, onRequestDelete, onImport }: LibraryPageProps) {
  const [query, setQuery] = useState("");
  const [formatFilter, setFormatFilter] = useState<FormatFilter>("ALL");
  const [sortBy, setSortBy] = useState<SortBy>("LAST_READ_DESC");

  const filtered = useMemo(
    () => filterAndSort(books, query, formatFilter, sortBy),
    [books, query, formatFilter, sortBy],
  );

  const clear = (): void => {
    setQuery("");
    setFormatFilter("ALL");
    setSortBy("LAST_READ_DESC");
  };

  if (books.length === 0) {
    return (
      <main className="library-page library-empty">
        <h1>图书管理</h1>
        <p>导入第一本 EPUB，开始构建本地图书库。</p>
        <button className="primary-button" type="button" onClick={onImport}>
          <FileArrowUp size={17} />导入第一本图书
        </button>
      </main>
    );
  }

  return (
    <main className="library-page">
      <header className="library-title">
        <div>
          <h1>图书管理</h1>
          <p>共 {books.length} 本图书</p>
        </div>
      </header>
      <section className="library-tools" aria-label="筛选图书">
        <label className="library-search">
          <MagnifyingGlass size={17} />
          <span className="visually-hidden">搜索图书</span>
          <input
            aria-label="搜索图书"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="搜索书名或作者"
          />
        </label>
        <label>
          <span className="visually-hidden">格式</span>
          <select
            aria-label="格式"
            value={formatFilter}
            onChange={(event) => setFormatFilter(event.target.value as FormatFilter)}
          >
            <option value="ALL">全部格式</option>
            <option value="EPUB">EPUB</option>
          </select>
        </label>
        <label>
          <span className="visually-hidden">排序</span>
          <select
            aria-label="排序"
            value={sortBy}
            onChange={(event) => setSortBy(event.target.value as SortBy)}
          >
            <option value="LAST_READ_DESC">最近阅读</option>
            <option value="IMPORTED_DESC">最近导入</option>
            <option value="TITLE_ASC">书名</option>
          </select>
        </label>
        <button className="primary-button" type="button" onClick={onImport}>
          <FileArrowUp size={17} />导入图书
        </button>
      </section>
      {filtered.length === 0 ? (
        <section className="no-results">
          <h2>没有匹配的图书</h2>
          <p>换一个关键词，或清除筛选条件。</p>
          <button type="button" onClick={clear}>清除条件</button>
        </section>
      ) : (
        <div className="book-table" role="table" aria-label="本地图书">
          <div className="book-table-head" role="row">
            <span role="columnheader">图书</span>
            <span role="columnheader">格式</span>
            <span role="columnheader">最近阅读</span>
            <span role="columnheader">操作</span>
          </div>
          {filtered.map((book) => (
            <div className="book-row" role="row" key={book.bookId}>
              <div className="book-title-cell" role="cell">
                <span className="library-cover" aria-hidden="true">
                  {book.metadata.title.slice(0, 1)}
                </span>
                <span>
                  <strong>{book.metadata.title}</strong>
                  <small>
                    {book.metadata.authors[0] ?? "未知作者"}
                    {book.temporary && (
                      <span className="book-temporary-badge"> · 本次进度无法保存</span>
                    )}
                  </small>
                </span>
              </div>
              <span role="cell" data-label="格式">EPUB</span>
              <time role="cell" data-label="最近阅读" dateTime={book.lastOpenedAt ?? book.importedAt}>
                {readLabel(book.lastOpenedAt)}
              </time>
              <div role="cell" className="book-actions">
                <button type="button" onClick={() => onOpen(book.bookId)} aria-label={`继续阅读《${book.metadata.title}》`}>
                  继续阅读
                </button>
                <button type="button" onClick={() => onRequestDelete(book.bookId)} aria-label={`删除《${book.metadata.title}》`}>
                  <Trash size={15} />删除
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
