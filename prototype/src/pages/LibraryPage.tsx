import { FileArrowUp, MagnifyingGlass, Trash } from "@phosphor-icons/react";
import { useMemo, useState } from "react";
import type { FormatFilter, SortBy } from "../data/demoBooks";
import type { LibraryController } from "../library/useLibrary";
import { filterAndSortBooks } from "../library/libraryStore";

type LibraryPageProps = {
  library: Pick<LibraryController, "books">;
  onOpen: (id: string) => void;
  onRequestDelete: (id: string) => void;
  onImport: () => void;
};

function readLabel(value: string | null): string {
  if (!value) return "未开始";
  return new Intl.DateTimeFormat("zh-CN", { month: "short", day: "numeric" }).format(
    new Date(value),
  );
}

export function LibraryPage({
  library,
  onOpen,
  onRequestDelete,
  onImport,
}: LibraryPageProps) {
  const [query, setQuery] = useState("");
  const [formatFilter, setFormatFilter] = useState<FormatFilter>("ALL");
  const [sortBy, setSortBy] = useState<SortBy>("LAST_READ_DESC");
  const books = useMemo(
    () => filterAndSortBooks(library.books, { query, formatFilter, sortBy }),
    [library.books, query, formatFilter, sortBy],
  );
  const clear = (): void => {
    setQuery("");
    setFormatFilter("ALL");
    setSortBy("LAST_READ_DESC");
  };

  if (library.books.length === 0) {
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
          <p>共 {library.books.length} 本图书</p>
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
      {books.length === 0 ? (
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
            <span role="columnheader">进度</span>
            <span role="columnheader">最近阅读</span>
            <span role="columnheader">操作</span>
          </div>
          {books.map((book) => (
            <div className="book-row" role="row" key={book.id}>
              <div className="book-title-cell" role="cell">
                <span className="library-cover" aria-hidden="true">
                  {book.coverUrl ? <img src={book.coverUrl} alt="" /> : book.title.slice(0, 1)}
                </span>
                <span><strong>{book.title}</strong><small>{book.author}</small></span>
              </div>
              <span role="cell" data-label="格式">{book.format}</span>
              <span className="progress-cell" role="cell" data-label="进度">
                <progress max="100" value={book.progress} />{book.progress}%
              </span>
              <time role="cell" data-label="最近阅读" dateTime={book.lastReadAt ?? book.importedAt}>
                {readLabel(book.lastReadAt)}
              </time>
              <div role="cell" className="book-actions">
                <button type="button" onClick={() => onOpen(book.id)} aria-label={`继续阅读《${book.title}》`}>
                  继续阅读
                </button>
                <button type="button" onClick={() => onRequestDelete(book.id)} aria-label={`删除《${book.title}》`}>
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
