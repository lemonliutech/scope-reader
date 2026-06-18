export type BookFormat = "EPUB";
export type FormatFilter = "ALL" | BookFormat;
export type SortBy = "LAST_READ_DESC" | "IMPORTED_DESC" | "TITLE_ASC";

export type LocalBook = {
  id: string;
  title: string;
  author: string;
  format: BookFormat;
  coverUrl: string | null;
  progress: number;
  lastReadAt: string | null;
  importedAt: string;
};

export type LibrarySnapshot = {
  books: LocalBook[];
  currentBookId: string | null;
};

export const DEMO_BOOKS = [
  {
    id: "sapiens",
    title: "人类简史",
    author: "尤瓦尔·赫拉利",
    format: "EPUB",
    coverUrl: "/assets/sapiens-cover.png",
    progress: 18,
    lastReadAt: "2026-06-18T02:24:00.000Z",
    importedAt: "2026-06-16T08:00:00.000Z",
  },
  {
    id: "from-the-soil",
    title: "乡土中国",
    author: "费孝通",
    format: "EPUB",
    coverUrl: null,
    progress: 42,
    lastReadAt: "2026-06-17T09:00:00.000Z",
    importedAt: "2026-06-15T08:00:00.000Z",
  },
  {
    id: "1587",
    title: "万历十五年",
    author: "黄仁宇",
    format: "EPUB",
    coverUrl: null,
    progress: 0,
    lastReadAt: null,
    importedAt: "2026-06-18T01:00:00.000Z",
  },
] satisfies LocalBook[];

export const DEFAULT_LIBRARY_STATE: LibrarySnapshot = {
  books: DEMO_BOOKS,
  currentBookId: "sapiens",
};
