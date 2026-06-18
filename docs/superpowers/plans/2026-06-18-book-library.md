# Scope Reader 图书管理 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 用当前图书切换器替换阅读页搜索式输入框，并新增支持导入、打开、删除、进度、搜索、格式筛选和最近阅读排序的 `/library` 页面。

**Architecture:** 保持 React + Vite 单页原型，不增加路由库；全部业务源代码迁移到严格 TypeScript。`AppShell` 通过 History API 切换阅读页和管理页，图书状态集中在 `useLibrary`，持久化与筛选排序保持为带明确类型的可测试纯函数。

**Tech Stack:** TypeScript 5、React 19、Vite 6、原生 CSS Grid、Phosphor Icons、Vitest、Testing Library、jsdom、localStorage

---

## 文件结构

| 文件 | 职责 |
| --- | --- |
| `prototype/src/App.tsx` | 组合全局状态、页面路由和弹窗 |
| `prototype/src/main.tsx` | React TypeScript 入口 |
| `prototype/tsconfig.json` | 严格 TypeScript 编译配置 |
| `prototype/vite.config.ts` | Vite 与 Vitest 配置 |
| `prototype/src/test/setup.ts` | Testing Library DOM 断言初始化 |
| `prototype/src/data/demoBooks.ts` | 演示图书与默认状态 |
| `prototype/src/library/libraryStore.ts` | 持久化、校验、导入、过滤与排序纯函数 |
| `prototype/src/library/libraryStore.test.ts` | 图书状态与查询规则单元测试 |
| `prototype/src/library/useLibrary.ts` | React 图书状态、回退与操作接口 |
| `prototype/src/library/useLibrary.test.tsx` | 状态持久化和操作 Hook 测试 |
| `prototype/src/routing/usePathname.ts` | History API 路由 Hook |
| `prototype/src/routing/usePathname.test.tsx` | 路由与 `popstate` 测试 |
| `prototype/src/components/AppHeader.tsx` | Scope 顶栏和页面入口 |
| `prototype/src/components/CurrentBookSwitcher.tsx` | 当前图书、最近图书和导入入口 |
| `prototype/src/components/ConfirmDialog.tsx` | 删除确认弹窗 |
| `prototype/src/pages/ReaderPage.tsx` | 现有正文和章节树 |
| `prototype/src/pages/LibraryPage.tsx` | 搜索、筛选、排序、表格和空状态 |
| `prototype/src/pages/LibraryPage.test.tsx` | 管理页交互测试 |
| `prototype/src/styles.css` | 顶栏、切换器、表格、状态与响应式 |
| `prototype/design-qa.md` | 最终视觉与交互 QA 证据 |

### Task 1: 将原型迁移到严格 TypeScript 并建立图书纯函数

**Files:**
- Modify: `prototype/package.json`
- Create: `prototype/tsconfig.json`
- Rename: `prototype/vite.config.mjs` → `prototype/vite.config.ts`
- Rename: `prototype/src/main.jsx` → `prototype/src/main.tsx`
- Rename: `prototype/src/App.jsx` → `prototype/src/App.tsx`
- Modify: `prototype/index.html`
- Modify: `prototype/vite.config.ts`
- Create: `prototype/src/test/setup.ts`
- Create: `prototype/src/data/demoBooks.ts`
- Create: `prototype/src/library/libraryStore.ts`
- Create: `prototype/src/library/libraryStore.test.ts`

- [ ] **Step 1: 安装测试依赖并添加脚本**

Run:

```bash
cd prototype
npm install -D typescript @types/react @types/react-dom vitest jsdom @testing-library/react @testing-library/jest-dom
npm pkg set scripts.test="vitest run"
npm pkg set scripts.test:watch="vitest"
npm pkg set scripts.typecheck="tsc --noEmit --pretty false"
```

Expected: `package.json` 包含 `test`、`test:watch` 和 `typecheck`，命令退出码为 0。

- [ ] **Step 2: 迁移入口并配置严格 TypeScript**

Run:

```bash
cd prototype
git mv vite.config.mjs vite.config.ts
git mv src/main.jsx src/main.tsx
git mv src/App.jsx src/App.tsx
```

将 `index.html` 的入口改为：

```html
<script type="module" src="/src/main.tsx"></script>
```

创建配置：

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "useDefineForClassFields": true,
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "skipLibCheck": true
  },
  "include": ["src", "vite.config.ts"]
}
```

重命名后立即为现有原型补齐最小类型，确保迁移提交本身满足 `strict`。在 `App.tsx` 的 `parts` 之前加入：

```ts
type Part = {
  id: string;
  title: string;
  chapters: string[];
};

type ChapterContent = {
  subtitle: string;
  intro: string[];
};

type TreeGroupProps = {
  part: Part;
  active: string;
  onSelect: (title: string) => void;
};
```

不改数组和对象内容，只做以下三个精确替换：

```diff
-const parts = [
+const parts: Part[] = [

-const paragraphs = {
+const paragraphs: Record<string, ChapterContent> = {

-function TreeGroup({ part, active, onSelect }) {
+function TreeGroup({ part, active, onSelect }: TreeGroupProps) {
```

将 `App` 内对应声明精确改为：

```tsx
const fileInputRef = useRef<HTMLInputElement>(null);
const articleRef = useRef<HTMLElement>(null);
const chapter = useMemo(
  () => paragraphs[activeChapter] ?? paragraphs["第1章 认知革命"]!,
  [activeChapter],
);

const selectChapter = (title: string): void => {
  if (paragraphs[title]) setActiveChapter(title);
  setOutlineOpen(false);
  requestAnimationFrame(() => articleRef.current?.scrollIntoView({ behavior: "smooth" }));
};
```

- [ ] **Step 3: 配置 jsdom 测试环境**

```ts
// prototype/src/test/setup.ts
import "@testing-library/jest-dom/vitest";
```

将 `prototype/vite.config.ts` 完整改为：

```ts
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: "./src/test/setup.ts",
    css: true,
  },
});
```

- [ ] **Step 4: 创建带类型的演示图书数据**

```ts
// prototype/src/data/demoBooks.ts
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
```

- [ ] **Step 5: 先写纯函数失败测试**

```ts
// prototype/src/library/libraryStore.test.ts
import { describe, expect, it } from "vitest";
import { DEMO_BOOKS } from "../data/demoBooks.js";
import {
  createImportedBook,
  filterAndSortBooks,
  parseLibraryState,
} from "./libraryStore.js";

describe("parseLibraryState", () => {
  it("rejects malformed storage values", () => {
    expect(parseLibraryState("not-json")).toBeNull();
    expect(parseLibraryState(JSON.stringify({ books: "bad" }))).toBeNull();
  });
});

describe("filterAndSortBooks", () => {
  it("combines author search, format filter and recent-read sorting", () => {
    const result = filterAndSortBooks(DEMO_BOOKS, {
      query: "费孝通",
      formatFilter: "EPUB",
      sortBy: "LAST_READ_DESC",
    });
    expect(result.map((book) => book.id)).toEqual(["from-the-soil"]);
  });

  it("puts unread books after read books for recent-read sorting", () => {
    const result = filterAndSortBooks(DEMO_BOOKS, {
      query: "",
      formatFilter: "ALL",
      sortBy: "LAST_READ_DESC",
    });
    expect(result.at(-1)?.id).toBe("1587");
  });
});

describe("createImportedBook", () => {
  it("accepts epub and derives a stable id and title", () => {
    expect(createImportedBook({ name: "银河帝国.epub" }, "2026-06-18T10:00:00.000Z"))
      .toMatchObject({ id: "file-银河帝国-epub", title: "银河帝国", format: "EPUB" });
  });

  it("rejects non-epub files", () => {
    expect(() => createImportedBook({ name: "notes.pdf" })).toThrow("当前原型仅支持 EPUB");
  });
});
```

- [ ] **Step 6: 运行测试确认失败**

Run:

```bash
cd prototype
npm test -- src/library/libraryStore.test.ts
```

Expected: FAIL，原因是 `libraryStore.ts` 尚不存在或导出函数未定义。

- [ ] **Step 7: 实现纯函数**

```ts
// prototype/src/library/libraryStore.ts
import type { LibrarySnapshot, LocalBook, FormatFilter, SortBy } from "../data/demoBooks.js";

type FilterOptions = { query: string; formatFilter: FormatFilter; sortBy: SortBy };
const VALID_SORTS = new Set<SortBy>(["LAST_READ_DESC", "IMPORTED_DESC", "TITLE_ASC"]);

export function isBook(value: unknown): value is LocalBook {
  if (!value || typeof value !== "object") return false;
  const book = value as Record<string, unknown>;
  return typeof book.id === "string" &&
    typeof book.title === "string" &&
    typeof book.author === "string" &&
    book.format === "EPUB" &&
    typeof book.progress === "number" && Number.isFinite(book.progress) &&
    typeof book.importedAt === "string" &&
    (book.lastReadAt === null || typeof book.lastReadAt === "string") &&
    (book.coverUrl === null || typeof book.coverUrl === "string");
}

export function parseLibraryState(raw: string): LibrarySnapshot | null {
  try {
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== "object") return null;
    const snapshot = value as Record<string, unknown>;
    if (!Array.isArray(snapshot.books) || !snapshot.books.every(isBook)) return null;
    if (snapshot.currentBookId !== null && typeof snapshot.currentBookId !== "string") return null;
    return { books: snapshot.books, currentBookId: snapshot.currentBookId as string | null };
  } catch {
    return null;
  }
}

export function filterAndSortBooks(books: readonly LocalBook[], options: FilterOptions): LocalBook[] {
  const query = options.query.trim().toLocaleLowerCase("zh-CN");
  const filtered = books.filter((book) => {
    const matchesQuery = !query || `${book.title} ${book.author}`.toLocaleLowerCase("zh-CN").includes(query);
    const matchesFormat = options.formatFilter === "ALL" || book.format === options.formatFilter;
    return matchesQuery && matchesFormat;
  });

  const sortBy = VALID_SORTS.has(options.sortBy) ? options.sortBy : "LAST_READ_DESC";
  return [...filtered].sort((a, b) => {
    if (sortBy === "TITLE_ASC") return a.title.localeCompare(b.title, "zh-CN");
    if (sortBy === "IMPORTED_DESC") return b.importedAt.localeCompare(a.importedAt);
    if (a.lastReadAt && b.lastReadAt) return b.lastReadAt.localeCompare(a.lastReadAt);
    if (a.lastReadAt) return -1;
    if (b.lastReadAt) return 1;
    return b.importedAt.localeCompare(a.importedAt);
  });
}

export function createImportedBook(file: Pick<File, "name">, now = new Date().toISOString()): LocalBook {
  if (!file.name.toLocaleLowerCase().endsWith(".epub")) {
    throw new Error("当前原型仅支持 EPUB");
  }
  const title = file.name.replace(/\.epub$/i, "").trim();
  const slug = title.normalize("NFKC").toLocaleLowerCase().replace(/\s+/g, "-").replace(/[^\p{L}\p{N}-]/gu, "");
  const id = `file-${slug}-epub`;
  return { id, title, author: "未知作者", format: "EPUB", coverUrl: null, progress: 0, lastReadAt: null, importedAt: now };
}
```

- [ ] **Step 8: 运行纯函数测试和类型检查确认通过**

Run:

```bash
cd prototype
npm test -- src/library/libraryStore.test.ts
npm run typecheck
```

Expected: PASS，5 tests passed；TypeScript 0 errors。

- [ ] **Step 9: 提交 TypeScript 迁移、纯函数与测试工具**

```bash
git add prototype/package.json prototype/package-lock.json prototype/tsconfig.json prototype/index.html prototype/vite.config.ts prototype/src/main.tsx prototype/src/App.tsx prototype/src/test/setup.ts prototype/src/data prototype/src/library/libraryStore.ts prototype/src/library/libraryStore.test.ts
git commit -m "refactor: migrate prototype to typescript"
```

### Task 2: 实现可持久化的 `useLibrary`

**Files:**
- Create: `prototype/src/library/useLibrary.ts`
- Create: `prototype/src/library/useLibrary.test.tsx`

- [ ] **Step 1: 写 Hook 失败测试**

```tsx
// prototype/src/library/useLibrary.test.tsx
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { DEFAULT_LIBRARY_STATE } from "../data/demoBooks.js";
import { useLibrary } from "./useLibrary.js";

describe("useLibrary", () => {
  beforeEach(() => localStorage.clear());

  it("falls back to demo data when storage is malformed", () => {
    localStorage.setItem("scope.prototype.library.v1", "bad");
    const { result } = renderHook(() => useLibrary());
    expect(result.current.books).toHaveLength(DEFAULT_LIBRARY_STATE.books.length);
    expect(result.current.notice).toBe("本地数据无法读取，已恢复演示图书");
  });

  it("deleting the current book clears currentBookId", () => {
    const { result } = renderHook(() => useLibrary());
    act(() => result.current.removeBook("sapiens"));
    expect(result.current.currentBookId).toBeNull();
    expect(result.current.books.some((book) => book.id === "sapiens")).toBe(false);
  });
});
```

- [ ] **Step 2: 运行 Hook 测试确认失败**

Run: `cd prototype && npm test -- src/library/useLibrary.test.tsx`

Expected: FAIL，`useLibrary.ts` 不存在。

- [ ] **Step 3: 实现 Hook**

```ts
// prototype/src/library/useLibrary.ts
import { useEffect, useMemo, useState } from "react";
import { DEFAULT_LIBRARY_STATE } from "../data/demoBooks.js";
import type { LibrarySnapshot, LocalBook } from "../data/demoBooks.js";
import { createImportedBook, parseLibraryState } from "./libraryStore.js";

export const STORAGE_KEY = "scope.prototype.library.v1";
type LibraryState = LibrarySnapshot & { notice: string };

function loadInitialState(): LibraryState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_LIBRARY_STATE, notice: "" };
    const parsed = parseLibraryState(raw);
    return parsed ? { ...parsed, notice: "" } : { ...DEFAULT_LIBRARY_STATE, notice: "本地数据无法读取，已恢复演示图书" };
  } catch {
    return { ...DEFAULT_LIBRARY_STATE, notice: "本地存储不可用，本次修改不会保留" };
  }
}

export function useLibrary() {
  const [state, setState] = useState<LibraryState>(loadInitialState);
  const currentBook = useMemo(() => state.books.find((book) => book.id === state.currentBookId) ?? null, [state.books, state.currentBookId]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ books: state.books, currentBookId: state.currentBookId }));
    } catch {
      setState((value) => value.notice ? value : { ...value, notice: "本地存储不可用，本次修改不会保留" });
    }
  }, [state.books, state.currentBookId]);

  const selectBook = (id: string): void => setState((value) => ({ ...value, currentBookId: id, books: value.books.map((book) => book.id === id ? { ...book, lastReadAt: new Date().toISOString() } : book) }));
  const removeBook = (id: string): void => setState((value) => ({ ...value, books: value.books.filter((book) => book.id !== id), currentBookId: value.currentBookId === id ? null : value.currentBookId }));
  const importBook = (file: Pick<File, "name">): LocalBook => {
    const book = createImportedBook(file);
    if (state.books.some((item) => item.id === book.id)) throw new Error("这本图书已经存在");
    setState((value) => ({ ...value, books: [book, ...value.books], currentBookId: book.id }));
    return book;
  };

  return { ...state, currentBook, selectBook, removeBook, importBook, clearNotice: () => setState((value) => ({ ...value, notice: "" })) };
}

export type LibraryController = ReturnType<typeof useLibrary>;
```

- [ ] **Step 4: 运行 Hook 测试确认通过**

Run: `cd prototype && npm test -- src/library/useLibrary.test.tsx && npm run typecheck`

Expected: PASS，2 tests passed；TypeScript 0 errors。

- [ ] **Step 5: 提交 Hook**

```bash
git add prototype/src/library/useLibrary.ts prototype/src/library/useLibrary.test.tsx
git commit -m "feat: persist prototype library state"
```

### Task 3: 增加 History API 路由

**Files:**
- Create: `prototype/src/routing/usePathname.ts`
- Create: `prototype/src/routing/usePathname.test.tsx`

- [ ] **Step 1: 写路由失败测试**

```tsx
// prototype/src/routing/usePathname.test.tsx
import { act, renderHook } from "@testing-library/react";
import { expect, it } from "vitest";
import { usePathname } from "./usePathname.js";

it("navigates and responds to popstate", () => {
  history.replaceState({}, "", "/");
  const { result } = renderHook(() => usePathname());
  act(() => result.current.navigate("/library"));
  expect(result.current.pathname).toBe("/library");
  act(() => {
    history.replaceState({}, "", "/");
    dispatchEvent(new PopStateEvent("popstate"));
  });
  expect(result.current.pathname).toBe("/");
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cd prototype && npm test -- src/routing/usePathname.test.tsx`

Expected: FAIL，Hook 未定义。

- [ ] **Step 3: 实现路由 Hook**

```ts
// prototype/src/routing/usePathname.ts
import { useEffect, useState } from "react";

export function usePathname() {
  const [pathname, setPathname] = useState(window.location.pathname);
  useEffect(() => {
    const onPopState = () => setPathname(window.location.pathname);
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);
  const navigate = (nextPath: string): void => {
    if (nextPath === window.location.pathname) return;
    window.history.pushState({}, "", nextPath);
    setPathname(nextPath);
  };
  return { pathname, navigate };
}
```

- [ ] **Step 4: 运行路由测试确认通过**

Run: `cd prototype && npm test -- src/routing/usePathname.test.tsx && npm run typecheck`

Expected: PASS，1 test passed；TypeScript 0 errors。

- [ ] **Step 5: 提交路由 Hook**

```bash
git add prototype/src/routing
git commit -m "feat: add lightweight library routing"
```

### Task 4: 拆分阅读页并实现当前图书切换器

**Files:**
- Create: `prototype/src/components/AppHeader.tsx`
- Create: `prototype/src/components/CurrentBookSwitcher.tsx`
- Create: `prototype/src/pages/ReaderPage.tsx`
- Modify: `prototype/src/App.tsx:1-240`

- [ ] **Step 1: 将现有正文和章节树移动到 `ReaderPage`**

迁移前先执行 `rg -n 'const parts|const paragraphs|function TreeGroup|const \[activeChapter|const selectChapter|<main id="top"|drawer-backdrop' prototype/src/App.tsx`，确认下面七个结构锚点均存在且顺序一致。随后把以下确定范围移入 `prototype/src/pages/ReaderPage.tsx`：

- 从 `const parts` 到 `TreeGroup` 函数闭合花括号：`parts`、`paragraphs`、相关类型与 `TreeGroup`；
- 从 `const [activeChapter` 到 `selectChapter` 函数闭合花括号：`activeChapter`、`outlineOpen`、`articleRef`、`chapter` 与 `selectChapter`，不移动夹在其中的 `aboutOpen` 和 `fileInputRef`；
- 从 `<main id="top" className="reader-grid"` 到紧随其后的 `drawer-backdrop` 条件渲染闭合花括号：正文列、章节树列与移动端遮罩。

删除迁移范围内对顶栏状态 `aboutOpen`、文件输入 `fileInputRef` 和顶栏图标的引用。保留原正文、目录 DOM 顺序、类名、测试 ID 与章节切换逻辑，不改布局行为。`ReaderPage` 的类型边界及空状态固定为：

```tsx
import type { LocalBook } from "../data/demoBooks.js";

type ReaderPageProps = {
  currentBook: LocalBook | null;
  onOpenLibrary: () => void;
};
```

函数签名使用 `export function ReaderPage({ currentBook, onOpenLibrary }: ReaderPageProps)`。在迁移后的状态声明之前加入唯一的空状态分支：

```tsx
if (!currentBook) {
  return (
    <main className="reader-empty">
      <h1>还没有打开图书</h1>
      <button type="button" onClick={onOpenLibrary}>前往图书管理</button>
    </main>
  );
}
```

在迁移后的 `.book-meta` 中只替换以下四个值，其余结构不变：

```tsx
{currentBook.coverUrl ? (
  <img src={currentBook.coverUrl} alt={`《${currentBook.title}》封面`} />
) : (
  <div className="cover-placeholder" aria-hidden="true">{currentBook.title.slice(0, 1)}</div>
)}
<div>
  <h2>{currentBook.title}</h2>
  <p>{currentBook.author}</p>
  <p>本地文件：{currentBook.title}.epub</p>
  <p>已读 {currentBook.progress}%</p>
</div>
```

- [ ] **Step 2: 实现当前图书切换器**

```tsx
// prototype/src/components/CurrentBookSwitcher.tsx
import { CaretDown, FileArrowUp } from "@phosphor-icons/react";
import { useEffect, useRef, useState } from "react";
import type { LocalBook } from "../data/demoBooks.js";

type CurrentBookSwitcherProps = {
  currentBook: LocalBook | null;
  recentBooks: LocalBook[];
  onSelect: (id: string) => void;
  onImport: () => void;
};

export function CurrentBookSwitcher({ currentBook, recentBooks, onSelect, onImport }: CurrentBookSwitcherProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const close = (event: PointerEvent) => !rootRef.current?.contains(event.target as Node) && setOpen(false);
    const escape = (event: KeyboardEvent) => event.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("pointerdown", close); document.removeEventListener("keydown", escape); };
  }, []);

  return <div className="book-switcher" ref={rootRef}>
    <button type="button" className="book-switcher-trigger" aria-expanded={open} onClick={() => setOpen((value) => !value)}>
      {currentBook?.coverUrl ? <img src={currentBook.coverUrl} alt="" /> : <span className="cover-fallback" aria-hidden="true" />}
      <span className="book-switcher-copy"><strong>{currentBook?.title ?? "选择一本图书"}</strong><small>{currentBook ? `${currentBook.format} · 已读 ${currentBook.progress}%` : "从本地导入 EPUB"}</small></span>
      <CaretDown size={16} />
    </button>
    {open && <div className="book-switcher-menu" role="menu">
      {recentBooks.map((book) => <button role="menuitem" type="button" key={book.id} onClick={() => { onSelect(book.id); setOpen(false); }}>{book.title}<small>{book.progress}%</small></button>)}
      <button role="menuitem" type="button" onClick={onImport}><FileArrowUp size={16} />导入图书</button>
    </div>}
  </div>;
}
```

- [ ] **Step 3: 实现全局顶栏**

```tsx
// prototype/src/components/AppHeader.tsx
import { CurrentBookSwitcher } from "./CurrentBookSwitcher.js";
import type { LibraryController } from "../library/useLibrary.js";

type AppHeaderProps = {
  pathname: string;
  library: LibraryController;
  onNavigate: (path: string) => void;
  onImport: () => void;
  onAbout: () => void;
};

export function AppHeader({ pathname, library, onNavigate, onImport, onAbout }: AppHeaderProps) {
  const recentBooks = [...library.books].sort((a, b) => (b.lastReadAt ?? "").localeCompare(a.lastReadAt ?? "")).slice(0, 5);
  return <header className="topbar"><div className="topbar-inner">
    <button className="brand" type="button" onClick={() => onNavigate("/")}>Scope</button>
    <CurrentBookSwitcher currentBook={library.currentBook} recentBooks={recentBooks} onSelect={(id: string) => { library.selectBook(id); onNavigate("/"); }} onImport={onImport} />
    <nav className="top-actions" aria-label="页面操作">
      <button type="button" aria-current={pathname === "/library" ? "page" : undefined} onClick={() => onNavigate("/library")}>图书管理</button>
      <button type="button" onClick={onAbout}>关于</button>
    </nav>
  </div></header>;
}
```

- [ ] **Step 4: 重新组合 `App`**

```tsx
export function App() {
  const library = useLibrary();
  const { pathname, navigate } = usePathname();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [aboutOpen, setAboutOpen] = useState(false);
  return <>
    <AppHeader pathname={pathname} library={library} onNavigate={navigate} onImport={() => fileInputRef.current?.click()} onAbout={() => setAboutOpen(true)} />
    <input ref={fileInputRef} className="visually-hidden" type="file" accept=".epub" />
    {pathname === "/library" ? <main className="library-page"><h1>图书管理</h1></main> : <ReaderPage currentBook={library.currentBook} onOpenLibrary={() => navigate("/library")} />}
  </>;
}
```

- [ ] **Step 5: 运行现有和新增测试、构建**

Run:

```bash
cd prototype
npm test
npm run typecheck
npm run build
```

Expected: 所有测试 PASS；TypeScript 0 errors；Vite build exit 0。

- [ ] **Step 6: 提交顶栏与阅读页拆分**

```bash
git add prototype/src/App.tsx prototype/src/components prototype/src/pages/ReaderPage.tsx
git commit -m "feat: replace search with current book switcher"
```

### Task 5: 实现图书管理页搜索、筛选、排序和响应式表格

**Files:**
- Create: `prototype/src/pages/LibraryPage.tsx`
- Create: `prototype/src/pages/LibraryPage.test.tsx`
- Modify: `prototype/src/App.tsx`

- [ ] **Step 1: 写管理页失败测试**

```tsx
// prototype/src/pages/LibraryPage.test.tsx
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DEMO_BOOKS } from "../data/demoBooks.js";
import { LibraryPage } from "./LibraryPage.js";

const library = { books: DEMO_BOOKS };

describe("LibraryPage", () => {
  it("searches by author and opens the matching book", () => {
    const onOpen = vi.fn();
    render(<LibraryPage library={library} onOpen={onOpen} onRequestDelete={vi.fn()} onImport={vi.fn()} />);
    fireEvent.change(screen.getByLabelText("搜索图书"), { target: { value: "费孝通" } });
    expect(screen.getByText("乡土中国")).toBeInTheDocument();
    expect(screen.queryByText("人类简史")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "继续阅读《乡土中国》" }));
    expect(onOpen).toHaveBeenCalledWith("from-the-soil");
  });

  it("shows a recoverable no-results state", () => {
    render(<LibraryPage library={library} onOpen={vi.fn()} onRequestDelete={vi.fn()} onImport={vi.fn()} />);
    fireEvent.change(screen.getByLabelText("搜索图书"), { target: { value: "不存在" } });
    expect(screen.getByText("没有匹配的图书")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "清除条件" }));
    expect(screen.getByText("人类简史")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cd prototype && npm test -- src/pages/LibraryPage.test.tsx`

Expected: FAIL，`LibraryPage.tsx` 不存在。

- [ ] **Step 3: 实现管理页**

```tsx
// prototype/src/pages/LibraryPage.tsx
import { useMemo, useState } from "react";
import { FileArrowUp, MagnifyingGlass, Trash } from "@phosphor-icons/react";
import { filterAndSortBooks } from "../library/libraryStore.js";
import type { LibraryController } from "../library/useLibrary.js";
import type { FormatFilter, SortBy } from "../data/demoBooks.js";

type LibraryPageProps = {
  library: Pick<LibraryController, "books">;
  onOpen: (id: string) => void;
  onRequestDelete: (id: string) => void;
  onImport: () => void;
};

export function LibraryPage({ library, onOpen, onRequestDelete, onImport }: LibraryPageProps) {
  const [query, setQuery] = useState("");
  const [formatFilter, setFormatFilter] = useState<FormatFilter>("ALL");
  const [sortBy, setSortBy] = useState<SortBy>("LAST_READ_DESC");
  const books = useMemo(() => filterAndSortBooks(library.books, { query, formatFilter, sortBy }), [library.books, query, formatFilter, sortBy]);
  const clear = () => { setQuery(""); setFormatFilter("ALL"); setSortBy("LAST_READ_DESC"); };

  if (library.books.length === 0) return <main className="library-page library-empty"><h1>图书管理</h1><p>导入第一本 EPUB，开始构建本地图书库。</p><button className="primary-button" type="button" onClick={onImport}><FileArrowUp size={17} />导入第一本图书</button></main>;

  return <main className="library-page">
    <header className="library-title"><div><h1>图书管理</h1><p>{library.books.length} 本本地图书</p></div></header>
    <section className="library-tools" aria-label="筛选图书">
      <label className="library-search"><MagnifyingGlass size={17} /><span className="visually-hidden">搜索图书</span><input aria-label="搜索图书" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索书名或作者" /></label>
      <label><span className="visually-hidden">格式</span><select aria-label="格式" value={formatFilter} onChange={(event) => setFormatFilter(event.target.value as FormatFilter)}><option value="ALL">全部格式</option><option value="EPUB">EPUB</option></select></label>
      <label><span className="visually-hidden">排序</span><select aria-label="排序" value={sortBy} onChange={(event) => setSortBy(event.target.value as SortBy)}><option value="LAST_READ_DESC">最近阅读</option><option value="IMPORTED_DESC">最近导入</option><option value="TITLE_ASC">书名</option></select></label>
      <button className="primary-button" type="button" onClick={onImport}><FileArrowUp size={17} />导入图书</button>
    </section>
    {books.length === 0 ? <section className="no-results"><h2>没有匹配的图书</h2><button type="button" onClick={clear}>清除条件</button></section> : <div className="book-table" role="table" aria-label="本地图书">
      <div className="book-table-head" role="row"><span role="columnheader">图书</span><span role="columnheader">格式</span><span role="columnheader">进度</span><span role="columnheader">最近阅读</span><span role="columnheader">操作</span></div>
      {books.map((book) => <div className="book-row" role="row" key={book.id}><div role="cell"><strong>{book.title}</strong><small>{book.author}</small></div><span role="cell" data-label="格式">{book.format}</span><span role="cell" data-label="进度"><progress max="100" value={book.progress} />{book.progress}%</span><time role="cell" data-label="最近阅读" dateTime={book.lastReadAt ?? book.importedAt}>{book.lastReadAt ? "最近读过" : "未开始"}</time><div role="cell" className="book-actions"><button type="button" onClick={() => onOpen(book.id)} aria-label={`继续阅读《${book.title}》`}>继续阅读</button><button type="button" onClick={() => onRequestDelete(book.id)} aria-label={`删除《${book.title}》`}><Trash size={16} />删除</button></div></div>)}
    </div>}
  </main>;
}
```

- [ ] **Step 4: 在 `App.tsx` 接入管理页**

增加导入：

```tsx
import { LibraryPage } from "./pages/LibraryPage.js";
```

将 Task 4 的管理页路由壳替换为：

```tsx
{pathname === "/library" ? (
  <LibraryPage
    library={library}
    onOpen={(id: string) => {
      library.selectBook(id);
      navigate("/");
    }}
    onRequestDelete={() => undefined}
    onImport={() => fileInputRef.current?.click()}
  />
) : (
  <ReaderPage currentBook={library.currentBook} onOpenLibrary={() => navigate("/library")} />
)}
```

此时删除按钮暂不改变状态；Task 6 在确认弹窗存在后统一接线，避免无确认直接删除。

- [ ] **Step 5: 运行管理页测试确认通过**

Run: `cd prototype && npm test -- src/pages/LibraryPage.test.tsx && npm run typecheck && npm run build`

Expected: PASS，2 tests passed；TypeScript 0 errors；Vite build exit 0。

- [ ] **Step 6: 提交管理页**

```bash
git add prototype/src/App.tsx prototype/src/pages/LibraryPage.tsx prototype/src/pages/LibraryPage.test.tsx
git commit -m "feat: add searchable local book library"
```

### Task 6: 接通导入、重复校验、删除确认与提示

**Files:**
- Create: `prototype/src/components/ConfirmDialog.tsx`
- Modify: `prototype/src/App.tsx`
- Modify: `prototype/src/pages/LibraryPage.test.tsx`

- [ ] **Step 1: 补充删除请求测试**

```tsx
it("requests deletion with the selected book id", () => {
  const onRequestDelete = vi.fn();
  render(<LibraryPage library={library} onOpen={vi.fn()} onRequestDelete={onRequestDelete} onImport={vi.fn()} />);
  fireEvent.click(screen.getByRole("button", { name: "删除《人类简史》" }));
  expect(onRequestDelete).toHaveBeenCalledWith("sapiens");
});
```

- [ ] **Step 2: 实现确认弹窗**

```tsx
// prototype/src/components/ConfirmDialog.tsx
import { X } from "@phosphor-icons/react";
import type { LocalBook } from "../data/demoBooks.js";

type ConfirmDialogProps = {
  book: LocalBook | null;
  onCancel: () => void;
  onConfirm: () => void;
};

export function ConfirmDialog({ book, onCancel, onConfirm }: ConfirmDialogProps) {
  if (!book) return null;
  return <div className="dialog-backdrop" role="presentation" onMouseDown={onCancel}>
    <section className="dialog" role="alertdialog" aria-modal="true" aria-labelledby="delete-title" onMouseDown={(event) => event.stopPropagation()}>
      <button className="dialog-close" type="button" aria-label="关闭" onClick={onCancel}><X size={20} /></button>
      <h2 id="delete-title">删除《{book.title}》？</h2>
      <p>这会移除本地原型中的图书记录和阅读进度。</p>
      <div className="dialog-actions"><button type="button" onClick={onCancel}>取消</button><button className="danger-button" type="button" onClick={onConfirm}>删除</button></div>
    </section>
  </div>;
}
```

- [ ] **Step 3: 接通文件输入与错误提示**

在 `App.tsx` 的 React import 后增加 `import type { ChangeEvent } from "react";`，并增加：

```tsx
const [message, setMessage] = useState("");
const [pendingDeleteBookId, setPendingDeleteBookId] = useState<string | null>(null);
const handleImport = (event: ChangeEvent<HTMLInputElement>): void => {
  const file = event.target.files?.[0];
  event.target.value = "";
  if (!file) return;
  try {
    library.importBook(file);
    setMessage(`已导入《${file.name.replace(/\.epub$/i, "")}》`);
    navigate("/library");
  } catch (error) {
    setMessage(error instanceof Error ? error.message : "图书导入失败");
  }
};
```

文件输入改为：

```tsx
<input ref={fileInputRef} className="visually-hidden" type="file" accept=".epub,application/epub+zip" onChange={handleImport} />
```

把 `LibraryPage` 的临时 `onRequestDelete={() => undefined}` 替换为 `onRequestDelete={setPendingDeleteBookId}`。

删除确认接线：

```tsx
const pendingDeleteBook = library.books.find((book) => book.id === pendingDeleteBookId) ?? null;
const confirmDelete = (): void => {
  if (!pendingDeleteBook) return;
  library.removeBook(pendingDeleteBook.id);
  setMessage(`已删除《${pendingDeleteBook.title}》`);
  setPendingDeleteBookId(null);
  navigate("/library");
};

<ConfirmDialog book={pendingDeleteBook} onCancel={() => setPendingDeleteBookId(null)} onConfirm={confirmDelete} />
<div className="status-message" role="status" aria-live="polite">{message || library.notice}</div>
```

- [ ] **Step 4: 运行测试与构建**

Run:

```bash
cd prototype
npm test
npm run typecheck
npm run build
```

Expected: 所有测试 PASS；TypeScript 0 errors；Vite build exit 0。

- [ ] **Step 5: 提交导入与删除流程**

```bash
git add prototype/src/App.tsx prototype/src/components/ConfirmDialog.tsx prototype/src/pages/LibraryPage.test.tsx
git commit -m "feat: add library import and delete flows"
```

### Task 7: 实现已确认视觉与响应式

**Files:**
- Modify: `prototype/src/styles.css:77-156`
- Modify: `prototype/src/styles.css:400-504`

- [ ] **Step 1: 替换搜索输入框样式**

删除 `.book-entry` 和 `.entry-shortcut`，增加：

```css
.topbar-inner {
  grid-template-columns: 92px minmax(240px, 310px) 1fr;
}

.book-switcher { position: relative; min-width: 0; }
.book-switcher-trigger {
  width: 100%; height: 44px; display: grid;
  grid-template-columns: 26px minmax(0, 1fr) 18px;
  align-items: center; gap: 10px; padding: 5px 10px;
  background: #fff; border: 1px solid var(--border); border-radius: 4px;
  text-align: left; cursor: pointer;
}
.book-switcher-trigger img, .cover-fallback { width: 24px; height: 32px; object-fit: cover; border: 1px solid #c8ccd1; }
.cover-fallback { display: block; background: #eaecf0; }
.book-switcher-copy { min-width: 0; display: grid; }
.book-switcher-copy strong, .book-switcher-copy small { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.book-switcher-copy strong { font-size: 14px; }
.book-switcher-copy small { color: var(--muted); font-size: 11px; }
.book-switcher-menu { position: absolute; z-index: 30; top: calc(100% + 6px); left: 0; width: 310px; padding: 6px; background: #fff; border: 1px solid var(--border); box-shadow: 0 4px 12px rgba(0,0,0,.12); }
.book-switcher-menu button { width: 100%; min-height: 38px; display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 7px 9px; background: #fff; border: 0; text-align: left; cursor: pointer; }
.book-switcher-menu button:hover, .book-switcher-menu button:focus-visible { background: #f8f9fa; outline: 1px solid var(--soft-border); }
```

- [ ] **Step 2: 添加紧凑管理表格样式**

```css
.library-page { width: min(var(--workspace-width), calc(100% - 32px)); margin: 0 auto; padding: 34px 0 96px; }
.library-title { display: flex; align-items: end; justify-content: space-between; margin-bottom: 22px; }
.library-title h1 { margin: 0 0 4px; font-size: 30px; }
.library-title p { margin: 0; color: var(--muted); }
.library-tools { display: grid; grid-template-columns: minmax(220px, 1fr) 130px 140px auto; gap: 10px; align-items: center; margin-bottom: 18px; }
.library-search { height: 40px; display: flex; align-items: center; gap: 8px; padding: 0 10px; border: 1px solid var(--border); }
.library-search input { width: 100%; border: 0; outline: 0; }
.library-tools select, .primary-button { min-height: 40px; padding: 0 12px; border: 1px solid var(--border); background: #fff; }
.primary-button { display: inline-flex; align-items: center; justify-content: center; gap: 7px; color: #fff; background: #36c; border-color: #2a4b8d; cursor: pointer; }
.book-table-head, .book-row { display: grid; grid-template-columns: minmax(260px, 2fr) 100px 110px 120px 140px; gap: 12px; align-items: center; }
.book-table-head { padding: 8px; border-block: 1px solid var(--border); font-size: 12px; font-weight: 700; }
.book-row { min-height: 64px; padding: 10px 8px; border-bottom: 1px solid var(--soft-border); font-size: 14px; }
.book-row strong, .book-row small { display: block; }
.book-row small { margin-top: 3px; color: var(--muted); }
.book-row progress { width: 62px; height: 4px; margin-right: 7px; vertical-align: middle; }
.book-actions { display: flex; gap: 8px; }
.book-actions button { padding: 5px 4px; color: var(--link); background: transparent; border: 0; cursor: pointer; }
.danger-button { color: #fff; background: #b32424; border: 1px solid #8c1d1d; }
.no-results, .library-empty { padding-top: 72px; text-align: center; }
.status-message:empty { display: none; }
```

- [ ] **Step 3: 添加窄屏列表样式**

```css
@media (max-width: 860px) {
  .topbar-inner { grid-template-columns: 70px minmax(0, 1fr) auto; }
  .book-switcher-copy small { display: none; }
  .library-page { width: calc(100% - 24px); padding-top: 24px; }
  .library-tools { grid-template-columns: 1fr 1fr; }
  .library-search { grid-column: 1 / -1; }
  .book-table-head { display: none; }
  .book-row { grid-template-columns: 1fr auto; gap: 9px 16px; padding: 14px 0; }
  .book-row > [data-label]::before { content: attr(data-label) "："; color: var(--muted); }
  .book-actions { grid-column: 1 / -1; }
}

@media (max-width: 560px) {
  .top-actions button[aria-current="page"] { display: inline-flex; }
  .library-tools { grid-template-columns: 1fr; }
  .library-search { grid-column: auto; }
}
```

- [ ] **Step 4: 运行完整自动验证**

Run:

```bash
cd prototype
npm test
npm run typecheck
npm run build
```

Expected: 全部测试通过；TypeScript 0 errors；Vite build exit 0。

- [ ] **Step 5: 提交视觉与响应式**

```bash
git add prototype/src/styles.css
git commit -m "style: align library with wiki layout"
```

### Task 8: 浏览器全流程与设计 QA

**Files:**
- Modify: `prototype/design-qa.md`
- Create: `prototype/screenshots/library-desktop.png`
- Create: `prototype/screenshots/library-mobile.png`
- Modify: `README.md`

- [ ] **Step 1: 启动原型并验证桌面流程**

Run: `cd prototype && npm run dev`

在浏览器验证：

1. 阅读页顶部无搜索式输入框；
2. 点击当前图书组件可展开并切换图书；
3. 点击 `图书管理` 后 URL 为 `/library`；
4. 搜索 `费孝通` 只显示《乡土中国》；
5. 格式筛选和排序可组合；
6. 导入 `.pdf` 显示 `当前原型仅支持 EPUB`；
7. 导入 `.epub` 后新增图书；
8. 删除弹窗取消不修改数据，确认删除后图书消失；
9. 浏览器前进、后退恢复页面；
10. 控制台无 error 和 warning。

- [ ] **Step 2: 重新测量阅读页双栏**

在浏览器读取：

```ts
const article = document.querySelector('[data-testid="article-column"]').getBoundingClientRect();
const outline = document.querySelector('[data-testid="outline-column"]').getBoundingClientRect();
({ delta: outline.left - article.right, gap: getComputedStyle(document.querySelector('[data-testid="reader-grid"]')).columnGap });
```

Expected: `{ delta: 0, gap: "0px" }`。

- [ ] **Step 3: 捕获桌面与窄屏截图并更新 QA**

保存同状态截图到：

- `prototype/screenshots/library-desktop.png`
- `prototype/screenshots/library-mobile.png`

更新 `prototype/design-qa.md`，至少覆盖字体、间距、颜色、图片、文案、交互、响应式；只有无 P0/P1/P2 时写：

```md
final result: passed
```

- [ ] **Step 4: 更新 README**

在 `README.md` 的原型部分增加：

```md
- `/`：Wiki 风格阅读页
- `/library`：本地图书管理页
```

- [ ] **Step 5: 运行最终验证**

Run:

```bash
cd prototype
npm test
npm run typecheck
npm run build
rg -n "final result: passed" design-qa.md
git -C .. diff --check
```

Expected: 测试 0 失败；TypeScript 0 errors；构建成功；QA 为 passed；`git diff --check` 无输出。

- [ ] **Step 6: 提交 QA 与文档**

```bash
git add README.md prototype/design-qa.md prototype/screenshots
git commit -m "docs: verify local book library prototype"
```

## 计划自检结果

- 规格覆盖：输入框替换、当前图书切换、`/library`、搜索、筛选、排序、导入、删除、异常、响应式和双栏回归均有对应任务。
- 占位符扫描：计划无占位标记或未定义的错误处理步骤。
- 类型一致性：严格 TypeScript 开启，`LocalBook`、组件 Props、筛选值、排序值、存储键与设计文档一致。
- 范围控制：不加入路由库、元数据编辑、批量操作、封面修改、云同步或真实 EPUB 解析。
