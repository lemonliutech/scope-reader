import type {
  FormatFilter,
  LibrarySnapshot,
  LocalBook,
  SortBy,
} from "../data/demoBooks";

type FilterOptions = {
  query: string;
  formatFilter: FormatFilter;
  sortBy: SortBy;
};

function isBook(value: unknown): value is LocalBook {
  if (!value || typeof value !== "object") return false;
  const book = value as Record<string, unknown>;
  return (
    typeof book.id === "string" &&
    typeof book.title === "string" &&
    typeof book.author === "string" &&
    book.format === "EPUB" &&
    typeof book.progress === "number" &&
    Number.isFinite(book.progress) &&
    book.progress >= 0 &&
    book.progress <= 100 &&
    typeof book.importedAt === "string" &&
    (book.lastReadAt === null || typeof book.lastReadAt === "string") &&
    (book.coverUrl === null || typeof book.coverUrl === "string")
  );
}

export function parseLibraryState(raw: string): LibrarySnapshot | null {
  try {
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== "object") return null;
    const snapshot = value as Record<string, unknown>;
    if (!Array.isArray(snapshot.books) || !snapshot.books.every(isBook)) return null;
    if (snapshot.currentBookId !== null && typeof snapshot.currentBookId !== "string") return null;
    return {
      books: snapshot.books,
      currentBookId: snapshot.currentBookId as string | null,
    };
  } catch {
    return null;
  }
}

export function filterAndSortBooks(
  books: readonly LocalBook[],
  options: FilterOptions,
): LocalBook[] {
  const query = options.query.trim().toLocaleLowerCase("zh-CN");
  const filtered = books.filter((book) => {
    const haystack = `${book.title} ${book.author}`.toLocaleLowerCase("zh-CN");
    const matchesQuery = !query || haystack.includes(query);
    const matchesFormat = options.formatFilter === "ALL" || book.format === options.formatFilter;
    return matchesQuery && matchesFormat;
  });

  return [...filtered].sort((a, b) => {
    if (options.sortBy === "TITLE_ASC") return a.title.localeCompare(b.title, "zh-CN");
    if (options.sortBy === "IMPORTED_DESC") return b.importedAt.localeCompare(a.importedAt);
    if (a.lastReadAt && b.lastReadAt) return b.lastReadAt.localeCompare(a.lastReadAt);
    if (a.lastReadAt) return -1;
    if (b.lastReadAt) return 1;
    return b.importedAt.localeCompare(a.importedAt);
  });
}

export function createImportedBook(
  file: Pick<File, "name">,
  now = new Date().toISOString(),
): LocalBook {
  if (!file.name.toLocaleLowerCase().endsWith(".epub")) {
    throw new Error("当前原型仅支持 EPUB");
  }
  const title = file.name.replace(/\.epub$/i, "").trim();
  if (!title) throw new Error("无法识别图书名称");
  const slug = title
    .normalize("NFKC")
    .toLocaleLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^\p{L}\p{N}-]/gu, "");
  return {
    id: `file-${slug}-epub`,
    title,
    author: "未知作者",
    format: "EPUB",
    coverUrl: null,
    progress: 0,
    lastReadAt: null,
    importedAt: now,
  };
}
