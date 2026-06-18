# Scope Reader 技术设计

> 版本：0.3｜状态：待技术评审｜日期：2026-06-18

## 1. 设计目标

首版用 epub.js 实现 EPUB 阅读，但通用界面、书库和阅读状态不能依赖 EPUB 或第三方对象。未来增加 PDF、TXT、FB2、CBZ 等格式时，只新增格式引擎，不重写产品主流程。

技术栈：React、TypeScript、Vite、IndexedDB。所有解析和渲染在浏览器本地完成。

## 2. 模块边界

```text
UI / React
  -> Reader Application Services
    -> PublicationEngineRegistry
      -> EpubEngineAdapter
        -> EpubJsDriver
    -> LibraryRepository
      -> IndexedDbLibraryRepository
```

职责：

- UI：页面状态和用户交互，不认识 epub.js。
- Application Services：编排导入、打开、定位、保存和关闭流程。
- Engine Registry：根据内容探测结果选择格式引擎，不能只看扩展名。
- Format Adapter：把格式概念转换成统一领域模型。
- Driver：封装具体第三方库；只有 `EpubJsDriver` 可以导入 epub.js。
- Repository：以事务保存图书、元数据、位置与偏好。

通过 ESLint `no-restricted-imports` 或等价检查强制依赖方向。

## 3. 通用领域接口

```ts
interface PublicationEngine {
  readonly format: PublicationFormat;
  readonly capabilities: PublicationCapabilities;
  canOpen(source: PublicationSource): Promise<FormatConfidence>;
  inspect(source: PublicationSource): Promise<PublicationInspection>;
  open(source: PublicationSource): Promise<Publication>;
  close(): Promise<void>;
}

interface Publication {
  getMetadata(): Promise<BookMetadata>;
  getNavigation(): Promise<NavigationTree>;
  getReadingOrder(): Promise<ReadingOrderItem[]>;
  createRenderSession(
    target: HTMLElement,
    options: RenderOptions,
  ): Promise<RenderSession>;
}

interface RenderSession {
  display(target?: PublicationTarget): Promise<void>;
  next(): Promise<void>;
  previous(): Promise<void>;
  getLocation(): Promise<PublicationLocation>;
  applyPreferences(preferences: ReaderPreferences): Promise<void>;
  subscribe(listener: RenderEventListener): Unsubscribe;
  destroy(): Promise<void>;
}
```

`PublicationLocation` 使用格式标识和不透明载荷。EPUB CFI、PDF 页码、文本字符偏移、漫画页索引都由各自适配器解释。业务层只比较格式与版本，不解析载荷内部结构。

## 4. 数据流

### 4.1 导入

1. 读取文件并计算哈希。
2. Registry 调用引擎 `canOpen`，以内容探测结果选择引擎。
3. 引擎 `inspect` 返回格式、能力、元数据和阻断问题。
4. 应用层匹配产品支持矩阵；固定版式、关键脚本依赖或 DRM 在此停止。
5. 生成目录摘要和封面。
6. 一个 IndexedDB 事务写入文件、出版物记录和初始阅读状态。
7. 事务成功后，图书才出现在书库中。

### 4.2 阅读

1. 从 Repository 读取 Blob、元数据、位置和偏好。
2. Registry 打开对应引擎并创建 RenderSession。
3. 优先恢复格式位置；失败时退回阅读顺序索引并通知用户。
4. 渲染事件更新章节树和进度；写入进度时节流。
5. 切书或卸载页面时销毁会话和对象 URL。

## 5. 能力模型

通用能力包括：流式排版、分页、目录、锚点、搜索、媒体、脚本、加密、RTL 与竖排。格式适配器可以增加细分检查，但不能把格式专用字段直接暴露给 UI。

EPUB 首版策略：

- 支持流式排版、NCX、Navigation Document、内部锚点与常见静态资源。
- 部分支持 RTL、竖排、MathML、音视频和字体混淆，以样本测试为准。
- 不支持固定版式、关键脚本依赖和 DRM。

## 6. IndexedDB 模型

| Store | 内容 |
| --- | --- |
| `books` | ID、文件哈希、Blob、文件名、大小、导入与最近打开时间 |
| `publications` | 格式、引擎版本、规范化元数据、封面、能力检查与目录摘要 |
| `readingStates` | 格式位置、阅读顺序索引、百分比、更新时间 |
| `preferences` | 全局及按书覆盖的主题、字号、行距和页边距 |

文件哈希用于去重，不作为安全校验。数据库升级必须提供显式迁移；迁移失败不能删除用户书库。

## 7. 安全边界

- 图书内容属于不可信输入，在受限 iframe 或等价环境中渲染。
- 禁止出版物脚本、表单提交、弹窗和顶层导航。
- 远程资源默认禁用；外部链接显示域名并由用户确认。
- 对解压总量、压缩比、文件数、单资源大小和路径设置上限，防御 ZIP bomb 与路径穿越。
- 切书和销毁会话时释放 Blob URL、监听器和渲染器引用。

## 8. 异常体系

所有异常继承 `ScopeError`：

```ts
interface ScopeError extends Error {
  code: ScopeErrorCode;
  stage: ImportStage | ReaderStage | StorageStage;
  userMessage: string;
  recoverable: boolean;
  cause?: unknown;
  details?: Record<string, unknown>;
}
```

异常码按责任层枚举：

| 分类 | 异常码 |
| --- | --- |
| 文件 | `FILE_NOT_SELECTED`、`FILE_TYPE_INVALID`、`FILE_EMPTY`、`FILE_TOO_LARGE`、`FILE_READ_DENIED`、`FILE_READ_ABORTED`、`DUPLICATE_BOOK` |
| 格式选择 | `FORMAT_UNSUPPORTED`、`FORMAT_MISMATCH`、`FORMAT_ENGINE_NOT_FOUND`、`UNSUPPORTED_ENGINE_CAPABILITY` |
| EPUB 容器 | `ZIP_INVALID`、`ZIP_BOMB_SUSPECTED`、`MIMETYPE_MISSING`、`MIMETYPE_INVALID`、`CONTAINER_XML_MISSING`、`CONTAINER_XML_INVALID` |
| EPUB 结构 | `PACKAGE_DOCUMENT_MISSING`、`PACKAGE_DOCUMENT_INVALID`、`MANIFEST_INVALID`、`SPINE_EMPTY`、`SPINE_REFERENCE_MISSING`、`NAVIGATION_INVALID` |
| EPUB 兼容 | `UNSUPPORTED_EPUB_VERSION`、`UNSUPPORTED_FIXED_LAYOUT`、`UNSUPPORTED_SCRIPT_REQUIRED`、`UNSUPPORTED_DRM`、`UNSUPPORTED_ENCRYPTION`、`UNSUPPORTED_MEDIA_TYPE` |
| 内容 | `RESOURCE_MISSING`、`RESOURCE_DECODE_FAILED`、`CONTENT_DOCUMENT_INVALID`、`ANCHOR_NOT_FOUND` |
| 渲染 | `RENDER_TARGET_MISSING`、`RENDER_INITIALIZATION_FAILED`、`RENDER_RUNTIME_FAILED`、`LOCATION_INVALID` |
| 存储 | `INDEXEDDB_UNAVAILABLE`、`STORAGE_QUOTA_EXCEEDED`、`STORAGE_TRANSACTION_ABORTED`、`STORAGE_CORRUPTED`、`BOOK_PERSIST_FAILED`、`PROGRESS_PERSIST_FAILED`、`BOOK_DELETE_FAILED` |
| 生命周期 | `ENGINE_LOAD_FAILED`、`ENGINE_DISPOSE_FAILED`、`BROWSER_UNSUPPORTED`、`OUT_OF_MEMORY`、`OPERATION_ABORTED`、`UNKNOWN_ERROR` |

处理规则：

- 局部资源失败不阻断正文，但必须记录并可查看。
- 结构损坏、固定版式、关键脚本依赖和 DRM 属于阻断错误。
- 目录损坏但阅读顺序有效时生成自动目录，并显示警告。
- IndexedDB 不可用时允许临时阅读，但明确说明不能保存。
- `UNKNOWN_ERROR` 只允许出现在最终错误边界，必须保留原始 `cause`。
- 同一阶段发现多个问题时返回完整问题列表，不以第一条错误掩盖其余异常。

## 9. 测试策略

- 领域测试：格式选择、目录规范化、位置对象、能力决策和异常映射。
- 通用契约测试：每个 `PublicationEngine` 必须通过相同的打开、导航、定位、销毁测试。
- EPUB 契约测试：EPUB 适配器与 epub.js 驱动分别测试，防止第三方对象泄漏。
- 存储测试：事务、配额失败、迁移失败、损坏恢复和删除一致性。
- 安全测试：脚本不执行、外链拦截、远程资源禁用、ZIP 限制和资源释放。
- UI 测试：导入、进度、目录跳转、章节高亮、偏好设置和位置恢复。

样本矩阵见 [EPUB 兼容性附录](../../product/epub-compatibility.md)。

## 10. 技术验收

1. 只有 `EpubJsDriver` 导入 epub.js。
2. 使用测试假引擎时，UI 与书库无需修改即可完成导入和阅读流程。
3. 代表性 EPUB 2/3 样本通过导入、目录、渲染和位置恢复。
4. 固定版式、关键脚本依赖和 DRM 返回独立错误码。
5. 所有阻断错误包含阶段、中文原因和处理建议。
6. 页面卸载后不存在未释放的渲染会话、对象 URL 和事件监听器。
