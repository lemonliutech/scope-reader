# EPUB 兼容性附录

> 本文解释 EPUB 格式与 Scope Reader 首版边界，不承担产品主流程说明。

## 1. 支持结论

Scope Reader 首版支持无 DRM 的 EPUB 2/3 流式排版图书，重点覆盖小说、技术书、散文和长篇非虚构内容。

明确不支持：

- 固定版式 EPUB：页面坐标被锁定，需要独立的画布与跨页渲染能力。
- 出版物脚本：不执行 EPUB 内嵌 JavaScript，避免网络访问、存储读写和 DOM 注入风险。
- DRM：不获取许可证、不保存密钥、不绕过内容保护。

## 2. EPUB 的组成

`.epub` 本质上是符合 OCF 规则的 ZIP 容器。阅读器通常按以下链路解析：

1. `mimetype` 确认容器类型为 `application/epub+zip`。
2. `META-INF/container.xml` 指向包文档 OPF。
3. OPF `metadata` 提供书名、作者、语言等信息。
4. OPF `manifest` 声明正文、图片、样式、字体和媒体资源。
5. OPF `spine` 定义默认阅读顺序。
6. NCX 或 Navigation Document 提供章节层级和锚点。

任一关键结构缺失都要映射成具体异常，不能统一显示为“文件损坏”。

为兼容可读但打包顺序不规范的出版物，导入器允许 ZIP 目录项出现在
`mimetype` 之前；`mimetype` 仍必须存在、不得压缩，且内容必须精确为
`application/epub+zip`。该容错不放宽 ZIP 路径与解压规模的安全限制。

## 3. 版本差异

| 版本 | 主要特征 | 首版策略 |
| --- | --- | --- |
| OEBPS／EPUB 1.x | 早期包文档与内容模型 | 不承诺支持；识别后标记为实验性 |
| EPUB 2 | OPF 2.0、NCX 目录、XHTML 内容 | 支持常见流式图书 |
| EPUB 3.0 | 引入 HTML5、Navigation Document、Media Overlays、脚本和固定版式 | 支持流式静态内容 |
| EPUB 3.1／3.2／3.3 | 持续完善兼容、国际化、可访问性、安全与处理规则 | 按实际能力探测，不为小版本建立独立渲染器 |

规范依据：[W3C EPUB 3.3](https://www.w3.org/TR/epub-33/) 与 [EPUB 3.3 Reading Systems](https://www.w3.org/TR/epub-rs-33/)。

## 4. 目录与阅读顺序

- EPUB 2 使用 NCX；EPUB 3 使用 XHTML Navigation Document。
- 目录和 spine 不是同一个概念：目录负责语义导航，spine 负责默认阅读顺序。
- 同一个 XHTML 可以有多个章节锚点，当前章节不能只按文件名判断。
- `linear="no"` 项目不进入连续阅读，但仍可由目录或链接访问。
- 目录缺失或损坏、spine 有效时，可按 spine 生成平级“自动目录”。

## 5. 资源兼容矩阵

| 类型 | 首版状态 | 说明 |
| --- | --- | --- |
| XHTML | 支持 | 隔离渲染并禁用脚本 |
| CSS | 支持 | 与用户字号、行距、主题设置合并 |
| JPEG、PNG、GIF、WebP、SVG 图片 | 支持／降级 | 取决于浏览器解码能力 |
| 内嵌 SVG | 部分支持 | 流式正文内展示；固定版式 SVG 页面拒绝 |
| WOFF/WOFF2、OpenType 字体 | 支持／降级 | 加载失败时回退系统字体 |
| MathML | 部分支持 | 使用浏览器原生能力 |
| 音频／视频 | 部分支持 | 仅播放浏览器可解码格式 |
| Media Overlays（SMIL） | 仅识别 | 首版不提供同步朗读 |
| 远程资源 | 默认禁用 | 避免隐私泄漏和离线失效 |
| JavaScript | 不执行 | 保留可独立阅读的静态内容 |

RTL、竖排、复杂表格和字体混淆必须通过样本验证后逐项标记，不能根据规范存在就声称完整支持。

## 6. 三类明确拒绝

### 6.1 固定版式

典型标记为 `rendition:layout=pre-paginated`，并配合 viewport、页面方向和跨页属性。它常见于漫画、绘本、教材和画册。首版检测后返回 `UNSUPPORTED_FIXED_LAYOUT`，不尝试把固定页面强行转换成流式正文。

### 6.2 脚本内容

EPUB 3 允许容器约束脚本和 spine 级脚本。首版禁止执行所有出版物脚本。若静态内容仍完整，可以继续阅读并提示交互不可用；若核心内容依赖脚本，则返回 `UNSUPPORTED_SCRIPT_REQUIRED`。

### 6.3 加密与 DRM

`META-INF/encryption.xml` 既可能描述标准字体混淆，也可能描述内容加密，必须按算法标识区分。标准字体混淆不等于 DRM；只有引擎明确支持且样本测试通过时才启用。受许可证保护的正文返回 `UNSUPPORTED_DRM`，未知算法返回 `UNSUPPORTED_ENCRYPTION`。

## 7. 样本要求

兼容结论必须由可合法再分发的样本验证，至少覆盖：EPUB 2 NCX、EPUB 3 nav、多级目录、同文件多锚点、图片与字体、RTL、竖排、MathML、缺失资源、损坏 OPF、固定版式、脚本依赖、字体混淆与 DRM 标记。
