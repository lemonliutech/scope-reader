# Scope Reader 真实 EPUB 引擎 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把当前演示图书原型升级为可真实导入、校验、解析、持久化和阅读无 DRM EPUB 2/3 流式图书的前端应用。

**Architecture:** UI 只依赖格式无关的领域模型和 `ReaderService`；`EpubJsDriver` 是唯一导入 epub.js 的模块，`EpubEngineAdapter` 负责规范化数据，`IndexedDbLibraryRepository` 原子保存文件与阅读状态。章节 XHTML 在禁用脚本的自适应 sandbox iframe 中渲染，外层网页继续负责自然滚动。

**Tech Stack:** TypeScript 6、React 19、Vite 6、epubjs 0.3.93、idb 8.0.3、fflate 0.8.3、IndexedDB、Vitest、Testing Library、系统 Chrome／Playwright QA

---

## 文件结构

| 文件 | 职责 |
| --- | --- |
| `prototype/src/domain/publication.ts` | 通用出版物、目录、章节与位置类型 |
| `prototype/src/domain/scopeError.ts` | 阶段、异常码、问题聚合与错误转换 |
| `prototype/src/engine/PublicationEngine.ts` | 格式无关引擎与会话契约 |
| `prototype/src/engine/PublicationEngineRegistry.ts` | 内容探测与引擎选择 |
| `prototype/src/engine/epub/epubPreflight.ts` | ZIP、mimetype、container、限制与兼容性预检 |
| `prototype/src/engine/epub/EpubJsDriver.ts` | 唯一接触 epub.js 的驱动 |
| `prototype/src/engine/epub/EpubEngineAdapter.ts` | EPUB DTO 到通用领域模型的转换 |
| `prototype/src/storage/schema.ts` | IndexedDB schema 与记录类型 |
| `prototype/src/storage/IndexedDbLibraryRepository.ts` | 原子导入、读取、状态保存和删除 |
| `prototype/src/services/ReaderService.ts` | 导入、打开、切章与资源销毁编排 |
| `prototype/src/services/useReaderController.ts` | React 状态和服务生命周期 |
| `prototype/src/components/ChapterFrame.tsx` | sandbox iframe、资源策略与自适应高度 |
| `prototype/src/components/ImportStatus.tsx` | 导入阶段反馈 |
| `prototype/src/components/ImportError.tsx` | 完整诊断列表 |
| `prototype/src/pages/ReaderPage.tsx` | 接入真实章节和目录 |
| `prototype/src/pages/LibraryPage.tsx` | 接入 IndexedDB 书库 |
| `prototype/src/test/createEpubFixture.ts` | 生成真实 ZIP/EPUB 二进制测试样本 |
| `prototype/scripts/check-epub-boundary.mjs` | 检查 epub.js 依赖边界 |
| `prototype/scripts/generate-epub-fixtures.mjs` | 为浏览器 QA 生成真实 EPUB 文件 |

### Task 1: 建立领域类型、异常聚合与引擎契约

**Files:**
- Create: `prototype/src/domain/publication.ts`
- Create: `prototype/src/domain/scopeError.ts`
- Create: `prototype/src/domain/scopeError.test.ts`
- Create: `prototype/src/engine/PublicationEngine.ts`
- Create: `prototype/src/engine/PublicationEngineRegistry.ts`
- Create: `prototype/src/engine/PublicationEngineRegistry.test.ts`

- [ ] **Step 1: 先写错误聚合和 Registry 失败测试**

```ts
// prototype/src/domain/scopeError.test.ts
import { describe, expect, it } from "vitest";
import { blockingIssues, issue } from "./scopeError";

describe("blockingIssues", () => {
  it("returns every blocking issue without hiding warnings", () => {
    const issues = [
      issue("NAVIGATION_INVALID", "INSPECT_PUBLICATION", false),
      issue("UNSUPPORTED_FIXED_LAYOUT", "CHECK_CAPABILITIES", true),
      issue("UNSUPPORTED_DRM", "CHECK_CAPABILITIES", true),
    ];
    expect(blockingIssues(issues).map((item) => item.code)).toEqual([
      "UNSUPPORTED_FIXED_LAYOUT",
      "UNSUPPORTED_DRM",
    ]);
  });
});
```

```ts
// prototype/src/engine/PublicationEngineRegistry.test.ts
import { expect, it, vi } from "vitest";
import { PublicationEngineRegistry } from "./PublicationEngineRegistry";
import type { PublicationEngine } from "./PublicationEngine";

it("selects the engine with the highest content confidence", async () => {
  const low = { format: "EPUB", canOpen: vi.fn().mockResolvedValue(20) } as unknown as PublicationEngine;
  const high = { format: "EPUB", canOpen: vi.fn().mockResolvedValue(100) } as unknown as PublicationEngine;
  const registry = new PublicationEngineRegistry([low, high]);
  await expect(registry.select({ fileName: "book.bin", mediaType: "", size: 4, data: new ArrayBuffer(4) })).resolves.toBe(high);
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cd prototype && npm test -- src/domain/scopeError.test.ts src/engine/PublicationEngineRegistry.test.ts`

Expected: FAIL，模块尚不存在。

- [ ] **Step 3: 实现领域和异常类型**

`publication.ts` 使用完整定义：

```ts
import type { ScopeIssue } from "./scopeError";
export type PublicationFormat = "EPUB";
export type PublicationSource = { fileName: string; mediaType: string; size: number; data: ArrayBuffer };
export type BookMetadata = { title: string; authors: string[]; language: string | null; description: string | null; cover: Blob | null };
export type PublicationTarget = { format: PublicationFormat; locator: string };
export type NavigationNode = { id: string; label: string; target: PublicationTarget; children: NavigationNode[] };
export type ReadingOrderItem = { id: string; label: string; target: PublicationTarget; linear: boolean };
export type ChapterDocument = { id: string; title: string; html: string; baseUrl: string; warnings: ScopeIssue[] };
export type PublicationLocation = { format: PublicationFormat; locator: string; chapterIndex: number; scrollRatio: number };
export type PublicationInspection = { metadata: BookMetadata; navigation: NavigationNode[]; readingOrder: ReadingOrderItem[]; issues: ScopeIssue[] };
export type ReaderPreferences = { fontSize: number; lineHeight: number; theme: "LIGHT" | "DARK" };
export type FormatConfidence = 0 | 20 | 100;
```

`scopeError.ts` 使用以下公开 API：

```ts
export type ImportStage = "READ_FILE" | "DETECT_FORMAT" | "INSPECT_PUBLICATION" | "CHECK_CAPABILITIES" | "PREPARE_PUBLICATION" | "PERSIST_PUBLICATION" | "OPEN_READER";
export type ReaderStage = "LOAD_CHAPTER" | "RENDER_CHAPTER" | "SAVE_LOCATION" | "DISPOSE_SESSION";
export type StorageStage = "OPEN_DATABASE" | "READ_DATABASE" | "WRITE_DATABASE" | "DELETE_DATABASE";
export type ScopeErrorCode =
  | "FILE_NOT_SELECTED" | "FILE_TYPE_INVALID" | "FILE_EMPTY" | "FILE_TOO_LARGE" | "FILE_READ_DENIED" | "FILE_READ_ABORTED" | "DUPLICATE_BOOK"
  | "FORMAT_UNSUPPORTED" | "FORMAT_MISMATCH" | "FORMAT_ENGINE_NOT_FOUND" | "UNSUPPORTED_ENGINE_CAPABILITY"
  | "ZIP_INVALID" | "ZIP_BOMB_SUSPECTED" | "MIMETYPE_MISSING" | "MIMETYPE_INVALID" | "CONTAINER_XML_MISSING" | "CONTAINER_XML_INVALID"
  | "PACKAGE_DOCUMENT_MISSING" | "PACKAGE_DOCUMENT_INVALID" | "MANIFEST_INVALID" | "SPINE_EMPTY" | "SPINE_REFERENCE_MISSING" | "NAVIGATION_INVALID"
  | "UNSUPPORTED_EPUB_VERSION" | "UNSUPPORTED_FIXED_LAYOUT" | "UNSUPPORTED_SCRIPT_REQUIRED" | "UNSUPPORTED_DRM" | "UNSUPPORTED_ENCRYPTION" | "UNSUPPORTED_MEDIA_TYPE"
  | "RESOURCE_MISSING" | "RESOURCE_DECODE_FAILED" | "CONTENT_DOCUMENT_INVALID" | "ANCHOR_NOT_FOUND"
  | "RENDER_TARGET_MISSING" | "RENDER_INITIALIZATION_FAILED" | "RENDER_RUNTIME_FAILED" | "LOCATION_INVALID"
  | "INDEXEDDB_UNAVAILABLE" | "STORAGE_QUOTA_EXCEEDED" | "STORAGE_TRANSACTION_ABORTED" | "STORAGE_CORRUPTED" | "BOOK_PERSIST_FAILED" | "PROGRESS_PERSIST_FAILED" | "BOOK_DELETE_FAILED"
  | "ENGINE_LOAD_FAILED" | "ENGINE_DISPOSE_FAILED" | "BROWSER_UNSUPPORTED" | "OUT_OF_MEMORY" | "OPERATION_ABORTED" | "UNKNOWN_ERROR";

export type ScopeIssue = { code: ScopeErrorCode; stage: ImportStage | ReaderStage | StorageStage; userMessage: string; suggestion: string; blocking: boolean; details?: Record<string, unknown> };

export class ScopeException extends Error {
  constructor(readonly issues: ScopeIssue[], options?: ErrorOptions) {
    super(issues.map((item) => item.userMessage).join("；"), options);
    this.name = "ScopeException";
  }
}

export function issue(code: ScopeErrorCode, stage: ScopeIssue["stage"], blocking: boolean, details?: Record<string, unknown>): ScopeIssue {
  const copy = ISSUE_COPY[code];
  return { code, stage, blocking, details, userMessage: copy.userMessage, suggestion: copy.suggestion };
}

export const blockingIssues = (issues: readonly ScopeIssue[]): ScopeIssue[] => issues.filter((item) => item.blocking);
```

`ISSUE_COPY` 必须是 `Record<ScopeErrorCode, { userMessage: string; suggestion: string }>`，为联合类型中的每一个异常码提供中文原因和操作建议，缺项由 TypeScript 阻止编译。

- [ ] **Step 4: 实现引擎契约和 Registry**

```ts
// prototype/src/engine/PublicationEngine.ts
import type { ChapterDocument, FormatConfidence, PublicationInspection, PublicationLocation, PublicationSource, PublicationTarget } from "../domain/publication";
export interface PublicationSession {
  getInspection(): PublicationInspection;
  loadChapter(target: PublicationTarget): Promise<ChapterDocument>;
  getLocation(): PublicationLocation;
  destroy(): Promise<void>;
}
export interface PublicationEngine {
  readonly format: "EPUB";
  canOpen(source: PublicationSource): Promise<FormatConfidence>;
  inspect(source: PublicationSource): Promise<PublicationInspection>;
  open(source: PublicationSource): Promise<PublicationSession>;
}
```

```ts
// prototype/src/engine/PublicationEngineRegistry.ts
import { issue } from "../domain/scopeError";
import { ScopeException } from "../domain/scopeError";
import type { PublicationSource } from "../domain/publication";
import type { PublicationEngine } from "./PublicationEngine";
export class PublicationEngineRegistry {
  constructor(private readonly engines: PublicationEngine[]) {}
  async select(source: PublicationSource): Promise<PublicationEngine> {
    const ranked = await Promise.all(this.engines.map(async (engine) => ({ engine, confidence: await engine.canOpen(source) })));
    const selected = ranked.sort((a, b) => b.confidence - a.confidence)[0];
    if (!selected || selected.confidence === 0) throw new ScopeException([issue("FORMAT_ENGINE_NOT_FOUND", "DETECT_FORMAT", true)]);
    return selected.engine;
  }
}
```

- [ ] **Step 5: 验证并提交**

Run: `cd prototype && npm test -- src/domain src/engine/PublicationEngineRegistry.test.ts && npm run typecheck`

Expected: 2 tests PASS，TypeScript 0 errors。

```bash
git add prototype/src/domain prototype/src/engine/PublicationEngine.ts prototype/src/engine/PublicationEngineRegistry*
git commit -m "feat: define publication engine contracts"
```

### Task 2: 创建真实 EPUB fixture 和容器预检

**Files:**
- Modify: `prototype/package.json`
- Modify: `prototype/package-lock.json`
- Create: `prototype/src/test/createEpubFixture.ts`
- Create: `prototype/src/engine/epub/epubPreflight.ts`
- Create: `prototype/src/engine/epub/epubPreflight.test.ts`

- [ ] **Step 1: 安装固定版本依赖**

Run: `cd prototype && npm install epubjs@0.3.93 idb@8.0.3 fflate@0.8.3`

Expected: 三个包进入 `dependencies`，lockfile 更新。

- [ ] **Step 2: 创建可配置的真实 EPUB 二进制 fixture**

`createEpubFixture.ts` 使用 `fflate.zipSync` 生成包含未压缩首条 `mimetype`、`META-INF/container.xml`、`OPS/package.opf`、`OPS/nav.xhtml` 和 `OPS/chapter.xhtml` 的 `Uint8Array`。公开参数：

```ts
export type EpubFixtureOptions = { title?: string; author?: string; fixedLayout?: boolean; scripted?: boolean; encrypted?: boolean; omitContainer?: boolean; emptySpine?: boolean };
export function createEpubFixture(options: EpubFixtureOptions = {}): Uint8Array;
```

OPF 使用 EPUB 3.0、唯一标识符 `urn:uuid:scope-test-book`，nav 指向 `chapter.xhtml#start`；`fixedLayout` 写入 `rendition:layout=pre-paginated`，`scripted` 给章节 manifest item 增加 `properties="scripted"`，`encrypted` 增加 `META-INF/encryption.xml` 和未知算法 URI。

- [ ] **Step 3: 写预检失败测试**

```ts
import { describe, expect, it } from "vitest";
import { createEpubFixture } from "../../test/createEpubFixture";
import { preflightEpub } from "./epubPreflight";

describe("preflightEpub", () => {
  it("accepts a valid EPUB by content", () => expect(preflightEpub(createEpubFixture()).issues).toEqual([]));
  it("reports a missing container", () => expect(preflightEpub(createEpubFixture({ omitContainer: true })).issues.map((x) => x.code)).toContain("CONTAINER_XML_MISSING"));
  it("aggregates fixed layout, scripts and encryption", () => expect(preflightEpub(createEpubFixture({ fixedLayout: true, scripted: true, encrypted: true })).issues.map((x) => x.code)).toEqual(expect.arrayContaining(["UNSUPPORTED_FIXED_LAYOUT", "UNSUPPORTED_SCRIPT_REQUIRED", "UNSUPPORTED_ENCRYPTION"])));
});
```

- [ ] **Step 4: 运行测试确认失败**

Run: `cd prototype && npm test -- src/engine/epub/epubPreflight.test.ts`

Expected: FAIL，`epubPreflight.ts` 不存在。

- [ ] **Step 5: 实现预检**

先用 `DataView` 从 ZIP End of Central Directory 定位 central directory，逐条读取文件名、压缩大小和解压大小；在解压前检查条目数 `10_000`、总解压量 `500 MiB`、单资源 `50 MiB`、压缩比 `100:1` 和规范化路径。限制通过后才调用 `fflate.unzipSync`。用 `TextDecoder` + `DOMParser` 解析 container 和 OPF；返回：

```ts
export type EpubPreflight = { packagePath: string | null; entries: Map<string, Uint8Array>; issues: ScopeIssue[] };
export function preflightEpub(bytes: Uint8Array): EpubPreflight;
```

不得在发现第一个问题后提前返回；只有无法继续读取 ZIP 时返回单个 `ZIP_INVALID`。mimetype、container、package、spine、固定版式、scripted 和 encryption 检查都向同一 `issues` 数组追加。

- [ ] **Step 6: 验证并提交**

Run: `cd prototype && npm test -- src/engine/epub/epubPreflight.test.ts && npm run typecheck`

Expected: 3 tests PASS，TypeScript 0 errors。

```bash
git add prototype/package.json prototype/package-lock.json prototype/src/test/createEpubFixture.ts prototype/src/engine/epub
git commit -m "feat: validate epub containers"
```

### Task 3: 封装 epub.js Driver 与 EPUB Adapter

**Files:**
- Create: `prototype/src/engine/epub/EpubJsDriver.ts`
- Create: `prototype/src/engine/epub/EpubJsDriver.test.ts`
- Create: `prototype/src/engine/epub/EpubEngineAdapter.ts`
- Create: `prototype/src/engine/epub/EpubEngineAdapter.test.ts`
- Create: `prototype/src/types/epubjs.d.ts`
- Create: `prototype/scripts/check-epub-boundary.mjs`

- [ ] **Step 1: 写 Driver 和 Adapter 契约测试**

测试使用 `createEpubFixture()` 的真实 ArrayBuffer，断言：metadata 为测试标题和作者、navigation 包含 `chapter.xhtml#start`、reading order 非空、章节 HTML 含 `<h1 id="start">`；再用对象键递归检查返回值中不存在 `Book`、`Rendition`、`Spine` 实例。

Adapter 测试断言空目录时按 reading order 生成 `自动目录` 警告，固定版式预检问题保持原错误码。

- [ ] **Step 2: 运行测试确认失败**

Run: `cd prototype && npm test -- src/engine/epub/EpubJsDriver.test.ts src/engine/epub/EpubEngineAdapter.test.ts`

Expected: FAIL，Driver 和 Adapter 尚不存在。

- [ ] **Step 3: 实现 Driver DTO 与生命周期**

`EpubJsDriver.ts` 是代码库唯一允许出现 `import ePub from "epubjs"` 的文件。公开接口：

```ts
export type EpubDriverNavNode = { id: string; label: string; href: string; children: EpubDriverNavNode[] };
export type EpubDriverSpineItem = { id: string; href: string; linear: boolean };
export type EpubDriverInspection = { metadata: { title: string; creator: string; language?: string; description?: string }; navigation: EpubDriverNavNode[]; spine: EpubDriverSpineItem[]; cover: Blob | null };
export type EpubDriverChapter = { href: string; html: string; objectUrls: string[] };
export class EpubJsDriver {
  async inspect(data: ArrayBuffer): Promise<EpubDriverInspection>;
  async open(data: ArrayBuffer): Promise<void>;
  async loadChapter(href: string): Promise<EpubDriverChapter>;
  async destroy(): Promise<void>;
}
```

`open` 等待 `book.ready`、`book.loaded.metadata`、`book.loaded.navigation`；`loadChapter` 通过 spine item 加载并序列化 XHTML，所有创建的对象 URL 进入 `Set<string>`；`destroy` 对每个 URL 调用 `URL.revokeObjectURL`，再调用 `book.destroy()`，并用 `Promise.allSettled` 收集释放异常。

- [ ] **Step 4: 实现 Adapter**

Adapter 构造函数接收 `driverFactory: () => EpubJsDriver`。`canOpen` 对通过 ZIP/mimetype/container 的输入返回 `100`，仅扩展名匹配返回 `20`，否则 `0`。`inspect` 合并 `preflightEpub` 问题与 Driver DTO；`open` 返回实现 `PublicationSession` 的私有 `EpubPublicationSession`。目录节点 ID 使用 `crypto.randomUUID()` 的替代确定性哈希 `${parentId}:${index}:${href}`，保证刷新后稳定。

- [ ] **Step 5: 加入依赖边界扫描**

创建独立检查脚本：

```js
// prototype/scripts/check-epub-boundary.mjs
import { execFileSync } from "node:child_process";
const output = execFileSync("rg", ["-l", "from [\\\"']epubjs[\\\"']", "src"], { encoding: "utf8" }).trim();
const files = output ? output.split("\n") : [];
const invalid = files.filter((file) => file !== "src/engine/epub/EpubJsDriver.ts");
if (invalid.length) {
  process.stderr.write(`epub.js boundary violation:\n${invalid.join("\n")}\n`);
  process.exit(1);
}
```

在 `package.json` 增加 `"check:epub-boundary": "node scripts/check-epub-boundary.mjs"`。

- [ ] **Step 6: 验证并提交**

Run: `cd prototype && npm test -- src/engine/epub && npm run typecheck && npm run check:epub-boundary`

Expected: 所有 EPUB 测试 PASS；TypeScript 0 errors；边界扫描 exit 0。

```bash
git add prototype/package.json prototype/src/engine/epub prototype/src/types
git commit -m "feat: add replaceable epub engine"
```

### Task 4: 实现 IndexedDB Repository 原子持久化

**Files:**
- Create: `prototype/src/storage/schema.ts`
- Create: `prototype/src/storage/IndexedDbLibraryRepository.ts`
- Create: `prototype/src/storage/IndexedDbLibraryRepository.test.ts`

- [ ] **Step 1: 写真实 IndexedDB 行为测试**

安装测试依赖 `npm install -D fake-indexeddb@6.2.5`，在测试中 `import "fake-indexeddb/auto"`。测试：导入后同时存在 book/publication/state；重复 hash 抛出 `DUPLICATE_BOOK` 且不覆盖状态；模拟 transaction abort 后三个 store 均无记录；删除同步移除三个记录。

- [ ] **Step 2: 运行测试确认失败**

Run: `cd prototype && npm test -- src/storage/IndexedDbLibraryRepository.test.ts`

Expected: FAIL，Repository 尚不存在。

- [ ] **Step 3: 定义 schema 和 Repository API**

```ts
export type StoredBook = { bookId: string; sha256: string; blob: Blob; fileName: string; size: number; importedAt: string; lastOpenedAt: string | null };
export type StoredPublication = { bookId: string; format: "EPUB"; engineVersion: string; inspection: PublicationInspection };
export type StoredReadingState = { bookId: string; location: PublicationLocation; updatedAt: string };
export type StoredPreferences = { scope: string; preferences: ReaderPreferences };
export type ImportRecord = { book: StoredBook; publication: StoredPublication; readingState: StoredReadingState };
export type LibraryBook = { bookId: string; fileName: string; size: number; metadata: BookMetadata; location: PublicationLocation; importedAt: string; lastOpenedAt: string | null; temporary: boolean };
export type StoredBookBundle = { book: StoredBook; publication: StoredPublication; readingState: StoredReadingState; preferences: StoredPreferences | null };

export interface ScopeReaderDb extends DBSchema {
  books: { key: string; value: StoredBook };
  publications: { key: string; value: StoredPublication };
  readingStates: { key: string; value: StoredReadingState };
  preferences: { key: string; value: StoredPreferences };
}
export interface LibraryRepository {
  importBook(input: ImportRecord): Promise<void>;
  listBooks(): Promise<LibraryBook[]>;
  loadBook(bookId: string): Promise<StoredBookBundle | null>;
  saveReadingState(state: StoredReadingState): Promise<void>;
  deleteBook(bookId: string): Promise<void>;
}
```

- [ ] **Step 4: 实现原子事务和 DOMException 映射**

`openDB<ScopeReaderDb>("scope-reader", 1, { upgrade })` 创建四个 store。`importBook` 在一个 `readwrite` 事务中先检查 hash，再执行三个 `put`，最后 `await tx.done`。`QuotaExceededError` 映射 `STORAGE_QUOTA_EXCEEDED`，`AbortError` 映射 `STORAGE_TRANSACTION_ABORTED`，打开失败映射 `INDEXEDDB_UNAVAILABLE`；保留原始异常在 `details.causeName`。

- [ ] **Step 5: 验证并提交**

Run: `cd prototype && npm test -- src/storage && npm run typecheck`

Expected: Repository 测试全部 PASS，TypeScript 0 errors。

```bash
git add prototype/package.json prototype/package-lock.json prototype/src/storage
git commit -m "feat: persist epub library in indexeddb"
```

### Task 5: 实现 ReaderService 导入、打开与销毁编排

**Files:**
- Create: `prototype/src/services/ReaderService.ts`
- Create: `prototype/src/services/ReaderService.test.ts`
- Create: `prototype/src/services/useReaderController.ts`
- Create: `prototype/src/services/useReaderController.test.tsx`

- [ ] **Step 1: 写服务失败测试**

用 fake engine/repository 测试阶段序列严格为 `READ_FILE → DETECT_FORMAT → INSPECT_PUBLICATION → CHECK_CAPABILITIES → PREPARE_PUBLICATION → PERSIST_PUBLICATION → OPEN_READER`；阻断问题存在时 repository 未调用；打开第二本书时第一 session 的 `destroy` 被调用；destroy 失败仍尝试打开新 session并把 `ENGINE_DISPOSE_FAILED` 作为非阻断通知返回。

- [ ] **Step 2: 运行测试确认失败**

Run: `cd prototype && npm test -- src/services/ReaderService.test.ts`

Expected: FAIL，服务尚不存在。

- [ ] **Step 3: 实现服务**

```ts
export type ImportProgress = { stage: ImportStage; label: string };
export type ImportResult = { bookId: string | null; inspection: PublicationInspection | null; issues: ScopeIssue[]; temporary: boolean };
export type OpenedPublication = { bookId: string; inspection: PublicationInspection; location: PublicationLocation; temporary: boolean };
export class ReaderService {
  constructor(private registry: PublicationEngineRegistry, private repository: LibraryRepository) {}
  importFile(file: File, onProgress: (progress: ImportProgress) => void): Promise<ImportResult>;
  openBook(bookId: string): Promise<OpenedPublication>;
  loadChapter(target: PublicationTarget): Promise<ChapterDocument>;
  saveLocation(location: PublicationLocation): Promise<void>;
  close(): Promise<ScopeIssue[]>;
}
```

SHA-256 使用 `crypto.subtle.digest("SHA-256", data)` 并转十六进制。IndexedDB 不可用时保留 source 和 session 于内存，`temporary: true`，其他持久化异常保持阻断。

- [ ] **Step 4: 实现 React Controller**

Controller 状态使用判别联合：`idle | importing | ready | error`。公开 `books`、`currentBook`、`chapter`、`navigation`、`issues`、`importFile`、`openBook`、`openTarget`、`deleteBook`。effect cleanup 必须调用 `service.close()`；不得把 epub.js 对象放入 state。

- [ ] **Step 5: 验证并提交**

Run: `cd prototype && npm test -- src/services && npm run typecheck`

Expected: 服务与 Hook 测试全部 PASS，TypeScript 0 errors。

```bash
git add prototype/src/services
git commit -m "feat: orchestrate epub import and reading"
```

### Task 6: 实现 sandbox 章节渲染组件

**Files:**
- Create: `prototype/src/components/ChapterFrame.tsx`
- Create: `prototype/src/components/ChapterFrame.test.tsx`

- [ ] **Step 1: 写安全属性和高度测试**

渲染含 `<script>parent.__epubScriptRan=true</script>`、远程图片和正文的章节，断言 iframe `sandbox` 精确为 `allow-same-origin`、没有 `allow-scripts`；`srcDoc` 中远程 URL 被替换；load 后 style.height 等于模拟 document scrollHeight；unmount 调用 `onDispose`。

- [ ] **Step 2: 运行测试确认失败**

Run: `cd prototype && npm test -- src/components/ChapterFrame.test.tsx`

Expected: FAIL，组件不存在。

- [ ] **Step 3: 实现组件**

```tsx
type ChapterFrameProps = { chapter: ChapterDocument; preferences: ReaderPreferences; onDispose: () => void; onExternalLink: (url: string) => void };
export function ChapterFrame({ chapter, preferences, onDispose, onExternalLink }: ChapterFrameProps) {
  const ref = useRef<HTMLIFrameElement>(null);
  useEffect(() => onDispose, [onDispose]);
  const srcDoc = useMemo(() => buildSafeChapterDocument(chapter, preferences), [chapter, preferences]);
  const resize = (): void => { const body = ref.current?.contentDocument?.documentElement; if (body && ref.current) ref.current.style.height = `${body.scrollHeight}px`; };
  return <iframe ref={ref} className="chapter-frame" sandbox="allow-same-origin" title={chapter.title} srcDoc={srcDoc} scrolling="no" onLoad={resize} />;
}
```

`buildSafeChapterDocument` 用 DOMParser 移除 `script`、`form`、`object`、`embed`、事件属性和 meta refresh；删除远程 `src`/`href`，外链改为 `data-external-url`。iframe load 后父组件注册 capture click listener，把外链交给 `onExternalLink`，cleanup 时移除。

- [ ] **Step 4: 验证并提交**

Run: `cd prototype && npm test -- src/components/ChapterFrame.test.tsx && npm run typecheck`

Expected: 安全和生命周期测试 PASS。

```bash
git add prototype/src/components/ChapterFrame*
git commit -m "feat: render epub chapters safely"
```

### Task 7: 接入真实书库、导入状态和完整异常 UI

**Files:**
- Create: `prototype/src/components/ImportStatus.tsx`
- Create: `prototype/src/components/ImportError.tsx`
- Create: `prototype/src/components/ImportError.test.tsx`
- Create: `prototype/src/pages/ReaderPage.test.tsx`
- Modify: `prototype/src/App.tsx`
- Modify: `prototype/src/components/AppHeader.tsx`
- Modify: `prototype/src/pages/LibraryPage.tsx`
- Modify: `prototype/src/pages/ReaderPage.tsx`
- Modify: `prototype/src/styles.css`

- [ ] **Step 1: 写 UI 失败测试**

测试 `ImportError` 同时渲染固定版式和 DRM 两条问题的中文原因、建议和错误码；`ReaderPage` 接收真实 `chapter` 后渲染 `ChapterFrame` 而不是“故事的力量”演示段落；`LibraryPage` 对 temporary 图书显示“本次进度无法保存”。

- [ ] **Step 2: 运行测试确认失败**

Run: `cd prototype && npm test -- src/components/ImportError.test.tsx src/pages/ReaderPage.test.tsx src/pages/LibraryPage.test.tsx`

Expected: FAIL，新组件和 Props 尚未接入。

- [ ] **Step 3: 实现状态组件**

`ImportStatus` 接收 `ImportProgress` 并用 `role="status" aria-live="polite"` 显示阶段标签。`ImportError` 接收 `ScopeIssue[]`，每条渲染 `<h3>{userMessage}</h3><p>{suggestion}</p><code>{code}</code>`；阻断容器使用 `role="alert" tabIndex={-1}` 并在 mount 后 focus。

- [ ] **Step 4: 替换 App 数据源**

在 `App` 顶层用 `useMemo` 创建 Registry、EpubEngineAdapter、IndexedDbLibraryRepository 和 ReaderService，再调用 `useReaderController`。文件 input 的 change handler 直接传真实 `File`，不得再调用 `createImportedBook`。导入时显示 `ImportStatus`；完成后进入 `/books/{bookId}`；失败保留当前页面并显示 `ImportError`。

- [ ] **Step 5: 改造 ReaderPage 与 LibraryPage**

`ReaderPage` Props 改为 `{ publication, chapter, onOpenTarget, onOpenLibrary }`，章节树递归渲染 `NavigationNode[]`，正文区域只渲染 `ChapterFrame`。删除演示 `parts`、`paragraphs` 和硬编码正文。

`LibraryPage` 使用 Repository 返回的真实记录；删除动作调用 controller，进度和封面来自 `StoredPublication`。无图书时保留唯一“导入第一本图书”主操作。

- [ ] **Step 6: 保持布局约束并验证**

CSS 只增加状态、错误、iframe 和真实目录递归样式；不得修改 `.reader-grid` 的两列宽度、`column-gap: 0` 或 `.outline` 的共享边框。iframe `width:100%; border:0; overflow:hidden; display:block`。

Run: `cd prototype && npm test && npm run typecheck && npm run check:epub-boundary && npm run build`

Expected: 全部测试 PASS，TypeScript 0 errors，构建成功。

- [ ] **Step 7: 提交 UI 接入**

```bash
git add prototype/src prototype/package.json prototype/src/styles.css
git commit -m "feat: connect real epub reading flow"
```

### Task 8: 增加真实样本、浏览器流程和回归证据

**Files:**
- Create: `prototype/scripts/generate-epub-fixtures.mjs`
- Create: `prototype/src/test/fixtures/README.md`
- Modify: `prototype/design-qa.md`
- Modify: `README.md`

- [ ] **Step 1: 生成真实 EPUB 文件并记录来源**

`generate-epub-fixtures.mjs` 使用 `fflate.zipSync` 写入 `/tmp/scope-reader-epub-fixtures/`，生成 `epub2-ncx.epub`、`epub3-nav.epub`、`fixed-layout.epub`、`script-required.epub`、`encrypted.epub` 和 `multi-error.epub`。每个文件都包含真实 ZIP、mimetype、container、OPF 和 XHTML；EPUB 2 额外包含 NCX，EPUB 3 包含 nav。脚本输出每个文件的 SHA-256。`fixtures/README.md` 记录这些文件由本项目脚本生成、仅用于测试，不提交二进制副本，并列出每个变体的结构差异。

- [ ] **Step 2: 执行真实浏览器流程**

启动 `npm run dev`，用 Browser 插件；不可用时记录原因并用系统 Chrome + Playwright。验证：

1. 导入 EPUB 2，显示真实标题、作者、NCX 目录和章节。
2. 导入 EPUB 3，显示 nav 目录并切章。
3. 刷新页面恢复当前书、章节和滚动位置。
4. 重复导入不覆盖原进度。
5. 固定版式、脚本依赖、加密样本分别显示独立错误。
6. 组合损坏样本一次显示全部诊断。
7. 控制台无 error/warning，网络无远程出版物资源。
8. 桌面几何 `{ articleWidth: 780, outlineWidth: 340, delta: 0, gap: "0px" }`。
9. `320 × 844` 无横向溢出，目录抽屉可键盘关闭。

- [ ] **Step 3: 更新 QA 与 README**

`design-qa.md` 写入样本 SHA、浏览器版本、视口、交互路径、控制台结果、资源释放结果和完整异常截图结论。README 把“原型使用 localStorage”改为“IndexedDB 保存真实 EPUB”，补充支持边界和两个路由。

- [ ] **Step 4: 最终验证**

Run:

```bash
cd prototype
npm test
npm run typecheck
npm run check:epub-boundary
npm run build
rg -n "final result: passed" design-qa.md
git -C .. diff --check
```

Expected: 测试 0 失败；TypeScript 0 errors；边界扫描和构建成功；QA passed；diff check 无输出。

- [ ] **Step 5: 提交验收证据**

```bash
git add README.md prototype/design-qa.md prototype/scripts/generate-epub-fixtures.mjs prototype/src/test/fixtures/README.md
git commit -m "test: verify real epub reading flow"
```

## 计划自检结果

- 规格覆盖：引擎隔离、内容探测、真实 EPUB、错误聚合、IndexedDB 原子性、sandbox、资源释放、UI 状态、位置恢复和双栏回归均有任务。
- 类型一致性：`PublicationSource`、`PublicationInspection`、`PublicationSession`、`ScopeIssue`、`ImportResult` 和 Repository 记录在首次出现时定义，后续名称一致。
- 安全边界：不授予 iframe 脚本权限，不执行出版物脚本，不加载远程资源，不处理 DRM。
- 范围控制：不增加其他格式、整本连续挂载、全文搜索、批注、TTS、云同步或传统阅读器控制条。
