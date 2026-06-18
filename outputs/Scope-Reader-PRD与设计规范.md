# Scope Reader PRD 与设计规范

> 版本：0.2  
> 日期：2026-06-18  
> 状态：待产品评审  
> 依据：[W3C EPUB 3.3](https://www.w3.org/TR/epub-33/)、[W3C EPUB 3.3 Reading Systems](https://www.w3.org/TR/epub-rs-33/)、[epub.js](https://github.com/futurepress/epub.js)、[IndexedDB](https://developer.mozilla.org/docs/Web/API/IndexedDB_API)

## 1. 产品定义

Scope Reader 是一个面向多种数字图书格式、完全运行在浏览器中的通用阅读器。图书文件不上传服务器，解析、渲染、阅读进度保存均在本地完成，必要时使用 IndexedDB 保存文件 Blob、书籍元数据和阅读状态。首版只实现 EPUB，但领域模型、存储和阅读界面从第一天起保持格式无关，以便后续接入其他格式引擎。

产品的主要差异点是阅读结构：采用类似 Google 搜索结果页（SERP）的信息层级，左侧为高可读性的章节正文主列，右侧为粘性章节树与图书上下文。正文是视觉主体，目录是持续可见的导航，而不是传统阅读器中临时打开的侧栏。

## 2. 目标与非目标

### 2.1 首版目标

1. 用户可以拖拽或选择本地 EPUB 文件并立即阅读。
2. 支持无 DRM 的 EPUB 2 与 EPUB 3 流式排版图书。
3. 正确展示常见正文、标题、列表、表格、图片、链接、注释和基础样式。
4. 右侧展示层级章节树，点击可定位，阅读时自动高亮当前章节。
5. 自动保存并恢复阅读位置、字号、行距、主题和目录折叠状态。
6. 阅读引擎按格式可插拔；首版由 EPUB 适配器使用 epub.js，产品代码不直接依赖其具体 API。
7. 对不支持或损坏的图书给出可诊断的中文错误，不使用含糊的“打开失败”。

### 2.2 首版非目标

- 不支持固定版式 EPUB。
- 不执行 EPUB 内嵌 JavaScript。
- 不解密、绕过或接入 DRM。
- 不提供云端书库、账号同步、跨设备同步。
- 不做批注、全文搜索、TTS、AI 总结与社交能力。
- 首版不读取 PDF、TXT、Markdown、FB2、MOBI、AZW、CBZ 等其他格式，但架构必须允许后续增加适配器。
- 不保证还原出版社为特定阅读器制作的私有扩展。

## 3. 用户与核心任务

目标用户是希望在桌面浏览器中统一阅读不同来源数字图书的人。首版核心任务只有一条：导入一本可支持的 EPUB，快速确认目录结构，在正文与章节树之间连续导航，并在下次打开时回到原处。

成功标准：首次导入后，用户在三个可见步骤内进入正文；刷新页面或关闭浏览器后再次打开，能恢复到上次位置；任何不兼容情况都能明确指出原因和处理建议。

## 4. 信息架构与页面

### 4.1 空书库／导入页

- 顶栏仅包含 Scope 标识、导入按钮和设置入口。
- 页面主体提供拖拽区与文件选择按钮，并明确“文件仅在本机处理”。
- 下方用短文案说明支持边界：EPUB 2/3 流式排版；不支持固定版式、脚本与 DRM。
- 导入期间显示真实阶段：读取文件、检查容器、解析书籍、生成目录、准备阅读。

### 4.2 阅读页

- 顶栏：Scope、书名、导入新书、阅读设置。
- 主容器：宽屏下最大宽度约 1180–1280px，布局比例约为正文 720–780px、间距 64–80px、章节树 280–320px。
- 左侧正文：视觉上接近 SERP 主结果列，保持开放背景、清晰标题、适中行宽，不把正文包进厚重卡片。
- 右侧章节树：粘性定位；显示书名、作者、阅读进度和层级目录；当前章节使用克制的蓝色与左侧标记。
- 底部导航：上一篇、下一篇与章节进度，不依赖右侧目录才能完成阅读。
- 设置浮层：字号、行距、页边距、浅色／深色／跟随系统主题。

### 4.3 响应式行为

- `>= 1024px`：正文与章节树双栏显示。
- `768–1023px`：正文优先，章节树收进右侧抽屉。
- `< 768px`：单栏；顶栏压缩，目录由按钮打开全高抽屉；正文不出现横向滚动。

## 5. 核心交互

1. 导入：接受 `.epub`；不能只依赖扩展名，必须验证 MIME、ZIP 容器与 `mimetype`。
2. 解析：展示阶段进度；解析完成后自动进入第一条线性 spine 项或上次位置。
3. 目录：支持多级展开/折叠；点击目录节点跳转到对应资源与锚点；当前节点及祖先自动展开。
4. 阅读：支持前后章节；内部链接在书内跳转，外部链接二次确认后新窗口打开。
5. 进度：优先保存 EPUB CFI 或引擎中立位置对象，同时保存 spine 索引作为降级恢复依据。
6. 删除：删除书籍时同时删除文件、缓存、位置和偏好；操作需要确认。

## 6. EPUB 格式详解与兼容范围

### 6.1 EPUB 是什么

EPUB 是基于开放 Web 技术的数字出版格式。一个 `.epub` 文件本质上是遵循 OCF 规则的 ZIP 容器，内部以 XML、XHTML、CSS、图片、字体及可选媒体资源描述图书。阅读系统需要先发现包文档，再依据资源清单与阅读顺序组织内容。

### 6.2 版本体系

#### OEBPS／EPUB 1.x（历史格式）

- EPUB 的前身是 Open eBook Publication Structure（OEBPS）；EPUB 1.x 延续了早期包文档与内容模型。
- 这类文件在容器、包文档、目录和内容语法上与现代 EPUB 存在显著差异，现实样本也较少。
- Scope 首版不承诺 EPUB 1.x 兼容；若文件能被 epub.js 正常识别，可作为“实验性兼容”打开，否则返回 `UNSUPPORTED_EPUB_VERSION`，不能误报为文件损坏。

#### EPUB 2

- 包文档通常为 OPF 2.0。
- 目录通常使用 NCX（`application/x-dtbncx+xml`）。
- 正文常见 XHTML 1.1 风格内容。
- `guide` 可提供封面、目录、正文起点等旧式地标。
- Scope 将 NCX 转换为统一的树形导航模型；缺少目录时可根据 spine 生成平级降级目录。

#### EPUB 3／3.1／3.2／3.3

- 包文档使用 EPUB 3 系列 OPF。
- 使用 EPUB Navigation Document，以 XHTML `nav` 表示目录、地标与页码表。
- 内容基于 HTML5/XHTML，可包含 SVG、MathML、音视频、脚本和 Media Overlays。
- 支持更完整的语义、国际化、可访问性与排版控制。
- Scope 首版以 EPUB 3.3 的出版物与阅读系统模型为主要理论依据，并兼容常见 EPUB 3.x 文件。

版本差异说明：EPUB 3.0 引入 HTML5、Navigation Document、Media Overlays、脚本与固定版式等现代能力；EPUB 3.1 曾调整规范组织与部分兼容要求；EPUB 3.2 重新强化向后兼容；EPUB 3.3 将规范推进为 W3C Recommendation 并进一步明确国际化、可访问性、安全和处理要求。Scope 不按小版本建立不同渲染器，而是依据出版物实际声明的资源与能力进行探测。

### 6.3 OCF 容器结构

- `mimetype`：必须标识 `application/epub+zip`，规范文件通常要求位于容器首项且不压缩。
- `META-INF/container.xml`：声明一个或多个 rootfile，指向包文档 OPF。
- `META-INF/encryption.xml`：描述资源加密或字体混淆。Scope 可识别该文件；只允许引擎明确支持的标准字体混淆，不处理 DRM 加密内容。
- `META-INF/rights.xml`：可能包含数字版权管理信息；检测到需要授权的内容时拒绝打开。
- `META-INF/signatures.xml`、`manifest.xml`、`metadata.xml`：属于可选保留文件，首版读取时不得破坏，但不提供签名校验与扩展元数据 UI。

### 6.4 包文档 OPF

- `metadata`：书名、作者、语言、标识符、出版时间、修改时间、主题等。
- `manifest`：所有出版资源的清单及媒体类型，是资源发现的权威来源。
- `spine`：默认阅读顺序；`linear="no"` 的项目不进入连续阅读，但仍可通过目录或链接访问。
- `guide`：EPUB 2 旧式导航提示，EPUB 3 已废弃；仅作为兼容输入。
- `bindings`：旧式自定义媒体处理机制，已废弃；首版不支持。
- `collections`：资源集合扩展；首版解析但不形成独立产品能力。

### 6.5 导航格式

- EPUB 2 NCX：解析 `navMap/navPoint` 层级、标题和目标地址。
- EPUB 3 Navigation Document：解析 `epub:type="toc"`；可选读取 `landmarks` 与 `page-list`。
- 目录地址可能指向同一 XHTML 的不同锚点，不能仅以文件路径判断当前节点。
- 缺失、循环或断裂目录不得阻止正文阅读；系统应根据 spine 生成可标记为“自动生成”的降级目录。

### 6.6 内容文档与资源类型

| 类型 | EPUB 中的角色 | 首版策略 |
| --- | --- | --- |
| XHTML | 主要正文 | 支持；隔离渲染并禁用脚本 |
| SVG 文档／内嵌 SVG | 矢量图、公式、整页内容 | 部分支持；固定版式 SVG 页面拒绝，正文内 SVG 按浏览器能力展示 |
| CSS | 出版社样式 | 支持；与用户字号、行距、主题设置按优先级合并 |
| JPEG、PNG、GIF、WebP、SVG 图片 | 插图与封面 | 按浏览器解码能力支持；缺失资源显示明确占位与错误记录 |
| 字体 WOFF/WOFF2、OpenType | 内嵌字体 | 按浏览器和引擎能力支持；失败时使用系统字体，不阻断正文 |
| MathML | 数学公式 | 按浏览器原生能力展示；不额外引入公式转换引擎 |
| 音频／视频 | 嵌入媒体 | 部分支持；仅播放浏览器原生可解码格式，不自动联网获取资源 |
| Media Overlays（SMIL） | 文本与音频同步 | 首版识别但不提供同步朗读控制 |
| 远程资源 | 外部图片、字体或媒体 | 默认不加载，避免隐私泄漏和离线失效；提示用户存在远程资源 |
| JavaScript | 交互、动画、练习 | 不执行；移除或阻止脚本上下文 |

### 6.7 排版模型

#### 流式排版（Reflowable）

正文根据容器宽度、字号和行距重新流动，适合小说、技术书和大多数文字出版物，是首版支持的主要格式。横排、从右到左语言与竖排属于流式排版的不同书写模式；Scope 首版保证常见横排 LTR，RTL 与竖排按测试样本逐步增强并在能力矩阵中标记。

#### 固定版式（Fixed Layout）

通过 `rendition:layout=pre-paginated`、viewport、页面方向和跨页属性锁定页面坐标，常见于漫画、绘本、教材和画册。它需要按原始画布缩放、单双页编排和精确点击区域支持，与 Scope 的流式正文主列冲突，因此首版检测后明确拒绝，不尝试降级渲染。

### 6.8 脚本内容

EPUB 3 允许容器约束脚本和 spine 级脚本。脚本可能访问存储、发起网络请求、改变 DOM 或依赖特定阅读系统对象。首版在沙箱与内容策略层面禁止执行所有出版物脚本；保留无脚本时仍可阅读的静态内容。若关键内容依赖脚本，提示“该图书包含首版不支持的交互内容”。

### 6.9 加密、字体混淆与 DRM

- 标准字体混淆并不等同于 DRM，可在所选引擎明确声明能力且测试通过后支持。
- `encryption.xml` 可能同时描述字体混淆与内容加密，必须依据算法 URI 区分，不能看到加密文件就一概判断为 DRM。
- DRM 通常需要商店账户、许可证、设备授权或专用解密模块。Scope 不获取许可证、不保存密钥、不尝试绕过保护；检测到受保护的 spine 内容时拒绝打开。

### 6.10 兼容矩阵

| 能力 | 状态 |
| --- | --- |
| OEBPS／EPUB 1.x | 不承诺支持；仅实验性尝试 |
| 无 DRM EPUB 2 流式排版 | 支持 |
| 无 DRM EPUB 3.x 流式排版 | 支持 |
| NCX 与 EPUB Navigation Document | 支持 |
| 多级目录、锚点导航、内部链接 | 支持 |
| 基础图片、CSS、内嵌字体 | 支持或按浏览器能力降级 |
| RTL、竖排、复杂表格、MathML | 部分支持，需样本验证 |
| 音视频 | 按浏览器编解码能力部分支持 |
| Media Overlays 同步朗读 | 仅识别，不播放同步 |
| 远程资源 | 默认禁用 |
| 固定版式 | 不支持，导入时拒绝 |
| JavaScript／脚本内容 | 不执行 |
| DRM | 不支持，导入时拒绝 |

## 7. 技术架构

### 7.1 技术栈

- React + TypeScript + Vite。
- epub.js 作为首个 EPUB 底层驱动，由 `EpubEngineAdapter` 隔离其 API。
- IndexedDB 保存图书 Blob、书籍索引、进度和设置；可使用轻量封装，但领域层不依赖封装库。
- React 状态只管理界面生命周期；图书解析、阅读位置和持久化通过独立服务管理。

### 7.2 分层

```text
UI / React
  -> Reader Application Services
    -> PublicationEngine 接口
      -> EpubEngineAdapter
        -> EpubJsDriver（首版）
    -> LibraryRepository 接口
      -> IndexedDbLibraryRepository
```

约束：除 `src/infrastructure/epubjs/**` 外，任何文件不得导入 epub.js。CI 通过 ESLint `no-restricted-imports` 或等价规则强制执行。

### 7.3 引擎抽象

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
  createRenderSession(target: HTMLElement, options: RenderOptions): Promise<RenderSession>;
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

`PublicationFormat`、`PublicationSource`、`PublicationTarget`、`PublicationLocation`、`NavigationTree` 和错误类型必须是项目自有类型。epub.js 的 Book、Rendition、Section、Location、CFI 等对象不得穿透 EPUB 适配器边界。CFI 可以作为 EPUB 位置对象中的不透明字符串持久化，但业务层不解析其内部结构；未来 PDF 页码、文本字符偏移和漫画页索引都映射为各自的位置载荷。

### 7.4 能力探测

引擎提供格式无关的分页、流式排版、目录、搜索、媒体与加密能力标记，并允许格式适配器附加 EPUB 的 `fixedLayout`、`scripting`、`drm`、`mediaOverlays`、`verticalWriting`、`rtl` 等细分能力。应用层在导入检查结果与引擎能力之间做明确匹配；能力不足时抛出统一的 `UNSUPPORTED_*` 错误，不带病进入渲染阶段。

### 7.5 IndexedDB 数据模型

- `books`：`id`、文件哈希、Blob、文件名、大小、导入时间、最近打开时间。
- `publications`：格式 ID、引擎版本、规范化元数据、封面 Blob、格式版本、能力检查结果、目录摘要。
- `readingStates`：书籍 ID、位置对象、spine 索引、百分比、更新时间。
- `preferences`：全局与按书覆盖的主题、字号、行距、页边距。

文件哈希用于去重，不作为安全校验。写入采用事务；只有 Blob、元数据和初始状态全部成功后才将书籍显示为可用。

## 8. 安全与隐私

1. 文件默认不离开浏览器，不接入分析 SDK 或远程解析服务。
2. EPUB 内容视为不可信输入；渲染在受限 iframe 或等价隔离环境中，禁用脚本、表单提交、弹窗和顶层导航。
3. 外部链接必须显示目标域名并由用户确认。
4. 远程资源默认禁用；若未来允许，需要按书授权并明确隐私影响。
5. 对 ZIP 解压体积、文件数量、单资源大小和嵌套路径设置上限，防御 ZIP bomb 与内存耗尽。

## 9. 异常模型

所有异常继承 `ScopeError`，包含 `code`、`stage`、`message`、`userMessage`、`recoverable`、`cause` 与可选 `details`。界面展示中文 `userMessage`，诊断面板保留错误码与阶段。

### 9.1 导入与文件异常

- `FILE_NOT_SELECTED`：未选择文件。
- `FILE_TYPE_INVALID`：扩展名、MIME 或签名不符合 EPUB。
- `FILE_EMPTY`：文件为空。
- `FILE_TOO_LARGE`：超过产品配置的大小上限。
- `FILE_READ_DENIED`：浏览器无法读取文件。
- `FILE_READ_ABORTED`：用户或浏览器中止读取。
- `DUPLICATE_BOOK`：已存在相同哈希的图书。

### 9.2 容器与结构异常

- `ZIP_INVALID`：不是有效 ZIP。
- `ZIP_BOMB_SUSPECTED`：解压比例、文件数或总体积异常。
- `MIMETYPE_MISSING`、`MIMETYPE_INVALID`：容器声明缺失或错误。
- `CONTAINER_XML_MISSING`、`CONTAINER_XML_INVALID`：无法发现包文档。
- `PACKAGE_DOCUMENT_MISSING`、`PACKAGE_DOCUMENT_INVALID`：OPF 缺失或无法解析。
- `MANIFEST_INVALID`：资源清单缺少必要字段或存在冲突。
- `SPINE_EMPTY`、`SPINE_REFERENCE_MISSING`：没有可读顺序或引用不存在。
- `NAVIGATION_INVALID`：目录损坏；可恢复时生成降级目录。

### 9.3 兼容性异常

- `FORMAT_UNSUPPORTED`：当前没有可处理该格式的适配器。
- `FORMAT_MISMATCH`：扩展名、MIME 与内容探测结果互相冲突。
- `FORMAT_ENGINE_NOT_FOUND`：格式已识别，但对应引擎未注册或加载失败。
- `UNSUPPORTED_EPUB_VERSION`：版本无法兼容。
- `UNSUPPORTED_FIXED_LAYOUT`：检测到固定版式。
- `UNSUPPORTED_SCRIPT_REQUIRED`：核心内容依赖脚本。
- `UNSUPPORTED_DRM`：检测到需要授权的内容加密。
- `UNSUPPORTED_ENCRYPTION`：存在未知或引擎不支持的加密算法。
- `UNSUPPORTED_MEDIA_TYPE`：关键 spine 资源类型不支持。
- `UNSUPPORTED_ENGINE_CAPABILITY`：当前引擎能力不足，可提示更换引擎。

### 9.4 内容与渲染异常

- `RESOURCE_MISSING`：图片、样式、字体或正文资源缺失。
- `RESOURCE_DECODE_FAILED`：资源存在但无法解码。
- `CONTENT_DOCUMENT_INVALID`：XHTML/XML 无法解析。
- `ANCHOR_NOT_FOUND`：目录或链接锚点不存在。
- `RENDER_TARGET_MISSING`：渲染容器已卸载。
- `RENDER_INITIALIZATION_FAILED`：渲染会话初始化失败。
- `RENDER_RUNTIME_FAILED`：阅读过程中渲染器异常。
- `LOCATION_INVALID`：保存的位置无法恢复；退回 spine 索引并告知用户。

### 9.5 存储异常

- `INDEXEDDB_UNAVAILABLE`：浏览器或隐私模式禁用 IndexedDB。
- `STORAGE_QUOTA_EXCEEDED`：空间不足。
- `STORAGE_TRANSACTION_ABORTED`：事务被中止。
- `STORAGE_CORRUPTED`：索引与 Blob 不一致。
- `BOOK_PERSIST_FAILED`、`PROGRESS_PERSIST_FAILED`：书籍或进度保存失败。
- `BOOK_DELETE_FAILED`：删除未完整完成。

### 9.6 生命周期与浏览器异常

- `ENGINE_LOAD_FAILED`：引擎适配器加载失败。
- `ENGINE_DISPOSE_FAILED`：旧渲染会话释放失败。
- `BROWSER_UNSUPPORTED`：缺少必要 API。
- `OUT_OF_MEMORY`：浏览器内存不足或标签页被回收。
- `OPERATION_ABORTED`：切书、关闭页面等导致操作主动取消。
- `UNKNOWN_ERROR`：只作为最后的错误边界；必须记录原始 cause，不能替代可识别异常。

## 10. 错误处理原则

- 可恢复错误只影响局部资源，例如图片缺失时正文继续显示并记录问题。
- 结构、固定版式、DRM 与关键脚本依赖属于阻断错误，导入阶段停止。
- 目录损坏但 spine 有效时，生成降级目录并明确标记。
- IndexedDB 不可用时允许当前会话临时阅读，但明确提示无法保存；这不是静默兜底。
- 同一阶段连续失败时展示全部已发现的问题列表，便于判断图书问题还是引擎问题。

## 11. 测试与验收

### 11.1 测试资产

建立合法可再分发的 EPUB 样本集：EPUB 2 NCX、EPUB 3 nav、多级目录、锚点目录、图片与字体、RTL、竖排、MathML、损坏 OPF、缺失资源、固定版式、脚本内容、字体混淆及 DRM 标记样本。

### 11.2 自动化测试

- 领域单元测试：目录规范化、位置对象、兼容决策、异常映射。
- 适配器契约测试：任意格式引擎必须通过同一套 `PublicationEngine` 行为测试；EPUB 驱动还需通过 EPUB 专用契约测试。
- 存储测试：事务成功、配额失败、损坏恢复、删除一致性。
- UI 测试：导入、解析、目录跳转、章节高亮、设置、恢复进度。
- 安全测试：脚本不执行、外链拦截、远程资源不加载、ZIP bomb 限制。

### 11.3 首版验收条件

1. 代表性 EPUB 2/3 流式样本均能导入、阅读和恢复进度。
2. 固定版式、关键脚本依赖和 DRM 样本分别返回对应错误码。
3. 代码扫描确认只有 `EpubJsDriver` 目录导入 epub.js，EPUB 适配器及通用应用层都不直接依赖它。
4. 替换为测试用假引擎后，UI 与应用服务无需修改即可运行关键流程。
5. 桌面端正文与章节树同时可用，移动端目录抽屉无溢出。
6. 所有失败路径均显示中文原因、阶段与可操作建议。

## 12. 实施阶段

1. 工程基础与设计令牌。
2. 格式无关领域模型、统一异常与 `PublicationEngine` 契约。
3. EPUB 适配器、epub.js 驱动及两层契约测试。
4. IndexedDB 书库与阅读状态。
5. 导入流程与兼容检查。
6. SERP 式阅读页、章节树与阅读设置。
7. 响应式、可访问性、安全与异常体验。
8. 样本矩阵验证与浏览器视觉验收。

## 13. 多格式路线图

### 阶段 0：通用阅读内核与 EPUB（当前）

- 建立 `PublicationEngine`、统一元数据、目录、阅读顺序、位置、渲染会话和异常模型。
- 使用 `EpubEngineAdapter -> EpubJsDriver` 实现 EPUB 2/3 流式阅读。
- 完成 SERP 式正文与章节树、IndexedDB 书库、进度恢复和阅读偏好。
- 以测试假引擎验证 UI 与存储层不依赖 EPUB 概念。

### 阶段 1：开放文本格式

- TXT：字符编码探测、段落识别、章节规则与字符偏移位置。
- Markdown：CommonMark 基础语法、标题目录、代码块和本地图片资源。
- HTML／单文件网页：清理不可信内容、提取正文、重写资源地址。
- FB2：解析 XML 元数据、章节层级、内嵌图片和注释。

这一阶段优先验证流式排版格式能否共用正文渲染与章节树，而不是复制 EPUB 阅读器。

### 阶段 2：页面型与漫画格式

- PDF：页码、缩放、连续滚动、文本层与目录；浏览器端优先评估 PDF.js。
- CBZ：按自然文件名排序图片、单双页与长图模式。
- CBR：浏览器端 RAR 解压能力、性能、许可证和包体积评估通过后再实现。
- DjVu：仅在存在成熟、可维护的 WebAssembly 解码方案时进入开发。

页面型格式不能伪装成流式正文；它们复用应用外壳、书库和右侧结构树，但拥有独立的画布渲染会话。

### 阶段 3：遗留电子书格式

- MOBI／PalmDOC：先支持无 DRM 的公开结构，明确字符编码和旧式目录限制。
- AZW／AZW3：只评估无 DRM 文件；不绕过 Kindle DRM。需要先完成格式合法性、解析器许可证与样本覆盖评估。
- FictionBook 衍生格式与其他区域性格式：依据真实用户需求和可获得测试样本排序。

### 阶段 4：跨格式阅读能力

- 全文搜索、书签、批注、引用导出和 TTS。
- 跨设备同步与可选云书库必须在隐私模型、加密和账号体系单独立项后实施。
- EPUB Media Overlays、固定版式及更复杂的可访问性能力按独立渲染能力推进。

### 路线图准入原则

每个新格式必须具备：公开或合法可用的格式规范、可再分发测试样本、明确的 DRM 边界、浏览器端可行性验证、独立适配器、通用契约测试与格式专用异常映射。不得为了“看起来支持”而把未知二进制格式转换成图片或静默丢失目录、排版和进度语义。

## 14. 长期扩展约束

新增格式只能通过注册新的 `PublicationEngine` 或底层驱动接入。任何扩展不得修改已有领域契约的语义，只能以向后兼容的能力标记、新位置载荷与可选接口扩展。EPUB 引擎抽象稳定后，可增加基于 Readium Web 或自研解析器的第二个 EPUB 驱动，验证同一格式内部也能替换实现。
