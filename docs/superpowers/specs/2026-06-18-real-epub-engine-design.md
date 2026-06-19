# Scope Reader 真实 EPUB 引擎设计

> 日期：2026-06-18  
> 状态：待用户书面评审  
> 适用范围：`prototype/` 从交互原型升级为可导入、解析、阅读和恢复的 EPUB 纵向切片

## 1. 目标与范围

本里程碑把当前仅保存文件名和演示内容的原型升级为真正的 EPUB 阅读网页。用户选择本地 EPUB 后，应用检查实际容器结构、解析元数据和目录、保存原始文件，并把当前章节渲染到现有“左侧正文、右侧章节树”的 SERP 页面中。

首批支持无 DRM 的 EPUB 2/3 流式排版图书。明确拒绝固定版式、关键脚本依赖和 DRM；不增加 PDF、TXT、批注、全文搜索、云同步或账号体系。

实现继续使用严格 TypeScript。所有 EPUB 解析和存储均在浏览器本地完成，文件不上传服务器。

## 2. 架构与依赖方向

```text
React UI
  → ReaderService
    → PublicationEngineRegistry
      → EpubEngineAdapter
        → EpubJsDriver
    → LibraryRepository
      → IndexedDbLibraryRepository
```

模块职责：

- React UI：显示导入阶段、错误、图书信息、正文和目录，不认识 epub.js、spine 或 CFI。
- `ReaderService`：编排导入、打开、切章、保存位置和关闭流程。
- `PublicationEngineRegistry`：根据内容探测选择引擎，不只使用扩展名。
- `EpubEngineAdapter`：把 EPUB 概念转换成通用领域模型。
- `EpubJsDriver`：唯一允许导入 epub.js 的模块。
- `LibraryRepository`：定义图书、出版物和阅读状态的持久化接口。
- `IndexedDbLibraryRepository`：用一个事务保存导入结果，负责数据库升级与读取恢复。

禁止 UI、应用服务或 Repository 导入 epub.js。通过测试和静态扫描共同约束依赖方向。

## 3. 通用领域模型

核心接口保持格式无关：

```ts
export type PublicationFormat = "EPUB";

export type PublicationSource = {
  fileName: string;
  mediaType: string;
  size: number;
  data: ArrayBuffer;
};

export type BookMetadata = {
  title: string;
  authors: string[];
  language: string | null;
  description: string | null;
  cover: Blob | null;
};

export type NavigationNode = {
  id: string;
  label: string;
  target: PublicationTarget;
  children: NavigationNode[];
};

export type PublicationTarget = {
  format: PublicationFormat;
  locator: string;
};

export type ChapterDocument = {
  id: string;
  title: string;
  html: string;
  baseUrl: string;
  warnings: ScopeIssue[];
};

export interface PublicationEngine {
  readonly format: PublicationFormat;
  canOpen(source: PublicationSource): Promise<FormatConfidence>;
  inspect(source: PublicationSource): Promise<PublicationInspection>;
  open(source: PublicationSource): Promise<PublicationSession>;
}

export interface PublicationSession {
  getMetadata(): BookMetadata;
  getNavigation(): NavigationNode[];
  getReadingOrder(): ReadingOrderItem[];
  loadChapter(target: PublicationTarget): Promise<ChapterDocument>;
  getLocation(): PublicationLocation;
  destroy(): Promise<void>;
}
```

`locator` 对 UI 是不透明字符串。EPUB 适配器可以用 href、锚点或 CFI，但其他层不得解析其内部结构。

## 4. epub.js 封装策略

`EpubJsDriver` 接收 `ArrayBuffer` 并负责：

1. 创建和加载 epub.js Book。
2. 等待 metadata、navigation、spine 和资源归档完成。
3. 返回驱动层 DTO，不把 epub.js 实例传出模块。
4. 加载指定章节的 XHTML 与关联资源。
5. 创建、追踪并释放章节所需的 Blob URL。
6. 销毁 Book、章节引用、事件监听器和临时 URL。

`EpubEngineAdapter` 负责：

- 规范化缺失或重复的标题、作者和目录节点 ID。
- 把 EPUB 目录目标映射为 `PublicationTarget`。
- 目录损坏但 spine 有效时生成平级自动目录，并产生警告。
- 根据 package metadata、manifest、spine 和 encryption 信息判定能力。
- 将第三方异常映射为 `ScopeIssue` 或 `ScopeError`。

若 epub.js 的某个内部 API 必须使用，该调用只能存在于 Driver，并由驱动契约测试锁定；Adapter 与 UI 不依赖该 API。

## 5. 章节网页渲染

章节使用同源 sandbox iframe 渲染，外层仍由当前网页自然滚动：

```html
<iframe sandbox="allow-same-origin" title="章节正文"></iframe>
```

规则：

- 不授予 `allow-scripts`、`allow-forms`、`allow-popups` 或顶层导航权限。
- 父页面在 iframe `load` 后读取正文高度并同步 iframe 高度；iframe 自身不出现纵向滚动条。
- 当前章节切换时销毁旧 iframe 内容及其 Blob URL。
- EPUB 样式在 iframe 内生效，用户字号、行距和主题以末尾覆盖样式注入。
- 远程 `http:`、`https:` 和协议相对资源默认替换为阻断占位并生成警告。
- 内部锚点留在当前章节；跨章节链接交给 `ReaderService` 导航。
- 外部链接不直接打开，转交 UI 显示域名和确认动作；首批只阻断，不实现确认弹窗。

首批只渲染当前章节，不把整本书同时挂载到 DOM。页面滚动位置与章节 locator 共同组成恢复位置。

## 6. IndexedDB 模型

数据库名为 `scope-reader`，首个正式 schema 版本为 `1`：

| Store | Key | 内容 |
| --- | --- | --- |
| `books` | `bookId` | 文件哈希、Blob、文件名、大小、导入时间、最近打开时间 |
| `publications` | `bookId` | 格式、引擎版本、元数据、封面 Blob、目录、阅读顺序、警告 |
| `readingStates` | `bookId` | locator、阅读顺序索引、章节内滚动比例、更新时间 |
| `preferences` | `scope` | 全局或按书字号、行距、主题 |

导入使用单个 `readwrite` 事务写入 `books`、`publications` 和 `readingStates`。任一写入失败时事务回滚，书库不出现半条记录。

文件 SHA-256 是去重 ID 的组成部分，但不是安全签名。相同哈希返回 `DUPLICATE_BOOK`，用户现有进度不得被覆盖。

IndexedDB 不可用时允许当前会话临时阅读，并显示“本次进度无法保存”；临时图书不伪装成已持久化书库记录。

## 7. 导入与阅读数据流

### 7.1 导入

1. `READ_FILE`：读取文件并检查大小和空文件。
2. `DETECT_FORMAT`：验证 ZIP 签名、mimetype 与 EPUB 容器结构。
3. `INSPECT_PUBLICATION`：解析 package、manifest、spine、navigation 和 encryption。
4. `CHECK_CAPABILITIES`：收集固定版式、脚本依赖、DRM、缺失资源等全部问题。
5. `PREPARE_PUBLICATION`：规范化元数据、封面、目录与阅读顺序。
6. `PERSIST_PUBLICATION`：一个事务写入 IndexedDB。
7. `OPEN_READER`：打开首个可读章节并进入阅读页。

UI 使用 `aria-live="polite"` 显示真实阶段，不伪造百分比。

### 7.2 阅读与恢复

1. Repository 读取 Blob、出版物记录、阅读位置和偏好。
2. Registry 选择已记录格式对应的引擎。
3. Session 打开保存的 locator；失效时退回阅读顺序索引并显示提示。
4. 章节切换更新 URL、目录高亮和阅读状态。
5. 滚动位置写入采用节流，切书和卸载前执行最后一次保存。
6. 切书或卸载时调用 `destroy()`，即使部分释放失败也继续清理其余资源。

## 8. 异常与完整诊断

所有问题实现统一结构：

```ts
export type ScopeIssue = {
  code: ScopeErrorCode;
  stage: ImportStage | ReaderStage | StorageStage;
  userMessage: string;
  suggestion: string;
  blocking: boolean;
  details?: Record<string, unknown>;
};
```

一次检查返回 `ScopeIssue[]`，不得只返回第一个异常。存在任一阻断项时停止持久化并展示完整列表。

本里程碑必须显式映射以下异常：

- 文件：`FILE_NOT_SELECTED`、`FILE_TYPE_INVALID`、`FILE_EMPTY`、`FILE_TOO_LARGE`、`FILE_READ_DENIED`、`FILE_READ_ABORTED`、`DUPLICATE_BOOK`。
- 格式：`FORMAT_UNSUPPORTED`、`FORMAT_MISMATCH`、`FORMAT_ENGINE_NOT_FOUND`、`UNSUPPORTED_ENGINE_CAPABILITY`。
- 容器：`ZIP_INVALID`、`ZIP_BOMB_SUSPECTED`、`MIMETYPE_MISSING`、`MIMETYPE_INVALID`、`CONTAINER_XML_MISSING`、`CONTAINER_XML_INVALID`。
- EPUB 结构：`PACKAGE_DOCUMENT_MISSING`、`PACKAGE_DOCUMENT_INVALID`、`MANIFEST_INVALID`、`SPINE_EMPTY`、`SPINE_REFERENCE_MISSING`、`NAVIGATION_INVALID`。
- 兼容性：`UNSUPPORTED_EPUB_VERSION`、`UNSUPPORTED_FIXED_LAYOUT`、`UNSUPPORTED_SCRIPT_REQUIRED`、`UNSUPPORTED_DRM`、`UNSUPPORTED_ENCRYPTION`、`UNSUPPORTED_MEDIA_TYPE`。
- 内容：`RESOURCE_MISSING`、`RESOURCE_DECODE_FAILED`、`CONTENT_DOCUMENT_INVALID`、`ANCHOR_NOT_FOUND`。
- 渲染：`RENDER_TARGET_MISSING`、`RENDER_INITIALIZATION_FAILED`、`RENDER_RUNTIME_FAILED`、`LOCATION_INVALID`。
- 存储：`INDEXEDDB_UNAVAILABLE`、`STORAGE_QUOTA_EXCEEDED`、`STORAGE_TRANSACTION_ABORTED`、`STORAGE_CORRUPTED`、`BOOK_PERSIST_FAILED`、`PROGRESS_PERSIST_FAILED`、`BOOK_DELETE_FAILED`。
- 生命周期：`ENGINE_LOAD_FAILED`、`ENGINE_DISPOSE_FAILED`、`BROWSER_UNSUPPORTED`、`OUT_OF_MEMORY`、`OPERATION_ABORTED`、`UNKNOWN_ERROR`。

`UNKNOWN_ERROR` 只能在最终错误边界使用，并保留原始 `cause`。局部资源失败不阻断可读正文；结构损坏、固定版式、关键脚本依赖和 DRM 必须阻断。

## 9. 安全与资源限制

- 文件大小上限：首批 `100 MiB`。
- ZIP 解压总量上限：`500 MiB`。
- 单资源上限：`50 MiB`。
- 文件条目上限：`10,000`。
- 压缩比超过 `100:1` 时返回 `ZIP_BOMB_SUSPECTED`。
- ZIP 路径规范化后不得越过容器根目录。
- 出版物脚本永不执行。
- 远程资源默认禁用。
- 所有 Blob URL 由创建它的 Driver 统一登记和释放。

这些限制是首批产品策略，不代表 EPUB 规范本身的限制。

## 10. UI 接入

现有页面结构保持不变，只替换数据来源并增加状态组件：

- `AppHeader`：当前图书来源改为 Repository 状态。
- `LibraryPage`：显示真实封面、作者、进度和持久化状态。
- `ReaderPage`：正文演示文本替换为 `ChapterFrame`，章节树使用真实导航。
- `ImportStatus`：显示当前导入阶段。
- `ImportError`：按阶段列出标题、原因、建议和错误码。
- `StorageNotice`：IndexedDB 不可用时说明临时阅读状态。

桌面布局继续保持正文 `780px`、章节栏 `340px`、`column-gap: 0` 和共享 `1px` 分隔线。移动端保持正文优先和章节抽屉，不新增传统阅读器控制条。

## 11. 测试与样本

测试分层：

1. 领域测试：Registry 选择、目录规范化、错误聚合、能力决策和位置回退。
2. 引擎契约：假引擎与 EPUB 引擎执行同一套打开、导航、加载章节和销毁测试。
3. Driver 测试：锁定 epub.js 封装 DTO，防止第三方对象泄漏。
4. Repository 测试：事务回滚、重复导入、读取恢复、删除一致性、配额与损坏异常。
5. 安全测试：脚本不执行、远程资源阻断、ZIP 限制和 Blob URL 释放。
6. UI 测试：导入阶段、完整错误列表、目录切换、章节高亮和存储提示。
7. 浏览器端到端：真实 EPUB 2、EPUB 3 和拒绝样本的导入、阅读、刷新恢复与移动端。

可再分发样本至少覆盖：

- EPUB 2 + NCX。
- EPUB 3 + Navigation Document。
- 多级目录和同文件多锚点。
- 图片与样式资源。
- 固定版式标记。
- 关键脚本依赖。
- DRM 或未知加密标记。
- 损坏 OPF、空 spine 和缺失资源。

自动化测试不得用伪造 JSON 代替真实 EPUB 端到端验证，但单元测试可以使用最小内存 fixture 隔离边界。

## 12. 验收标准

1. 只有 `EpubJsDriver` 导入 epub.js。
2. 用户导入真实 EPUB 2/3 后可看到真实书名、作者、封面、目录和当前章节。
3. 正文在 sandbox iframe 中禁用脚本，iframe 随内容增高，主网页负责滚动。
4. 点击真实目录节点可切章，URL、正文和目录高亮同步更新。
5. 刷新或重新选择图书后恢复章节及章节内位置。
6. 重复文件不会覆盖已有进度。
7. 固定版式、关键脚本依赖和 DRM 返回不同错误码及中文建议。
8. 一次检查发现多个问题时 UI 展示全部问题。
9. IndexedDB 写入失败不产生半条书库记录；不可用时可临时阅读并明确提示。
10. 切章、切书和卸载后没有遗留 Blob URL、会话或事件监听器。
11. 桌面双栏边界差为 `0px`，移动端 `320px` 无横向溢出。
12. 全量测试、严格 TypeScript、生产构建和真实浏览器流程均通过。

## 13. 非目标

- 不实现固定版式渲染。
- 不执行出版物脚本。
- 不处理或绕过 DRM。
- 不实现整本书连续挂载、分页翻页动画或底部控制条。
- 不实现全文搜索、批注、TTS、云同步或其他图书格式。
- 不承诺所有 EPUB 3 可选能力；兼容性必须由样本证明。
