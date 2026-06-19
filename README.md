# Scope Reader

Scope Reader 是一个完全运行在浏览器中的通用图书阅读网页程序。项目把图书渲染为 SERP 形态的内容网页，并用统一的解析、阅读状态和页面结构承载多种数字图书格式；当前首个实现目标是无 DRM 的 EPUB 2/3 流式排版图书。

核心界面严格采用搜索结果页（SERP）的结构：顶部是当前图书切换器，左侧是章节内容主列，右侧是紧邻正文、持续可见的章节大纲。最终页面是自然滚动的内容网页，不模拟传统阅读器书页。

## 当前状态

### HTML/CSS 交互原型

桌面双栏原型位于 `prototype/`，用于验证 Wiki 风格的正文排版与贴身章节树：

```bash
cd prototype
npm install
npm run dev
```

原型使用确定性的 CSS Grid：正文列 `780px`、章节树 `340px`、列间距 `0`，两栏共用 `1px` 分隔线。

原型路由：

- `/`：Wiki 风格阅读页，支持当前图书切换和章节树交互。
- `/library`：本地图书管理页，支持搜索、格式筛选、排序、导入、打开和删除。

原型使用 IndexedDB 保存真实 EPUB 二进制、阅读进度和偏好；SHA-256 去重防止重复导入；隐私模式不可用时自动降级为临时内存书库。

首版范围：

- 完全前端运行，图书不上传服务器。
- React、TypeScript 与 Vite。
- **IndexedDB 保存真实 EPUB 二进制、阅读进度和偏好**；SHA-256 去重；隐私模式降级为临时内存书库。
- 支持无 DRM 的 EPUB 2/3 流式排版。
- 不支持固定版式 EPUB，不执行 EPUB 脚本，不处理 DRM。
- epub.js 只存在于底层驱动 `EpubJsDriver.ts` 中，可由其他实现替换。

## 架构原则

应用层只依赖格式无关的 `PublicationEngine`：

```text
UI / React
  -> Reader Application Services
    -> PublicationEngine
      -> EpubEngineAdapter
        -> EpubJsDriver
    -> LibraryRepository
      -> IndexedDbLibraryRepository
```

EPUB CFI、PDF 页码、文本字符偏移和漫画页索引等格式差异封装在各自的位置载荷中，不向通用 UI 泄漏第三方引擎对象。

## 格式路线图

1. EPUB：无 DRM EPUB 2/3 流式排版。
2. 开放文本：TXT、Markdown、HTML、FB2。
3. 页面与漫画：PDF、CBZ；评估 CBR 与 DjVu。
4. 遗留电子书：评估无 DRM 的 MOBI、PalmDOC、AZW3。
5. 跨格式能力：搜索、书签、批注、引用导出、TTS 与可选同步。

每个新格式必须经过规范、测试样本、DRM 边界、浏览器可行性、独立适配器和契约测试评估。项目不会通过静默丢失内容语义来宣称格式兼容。

## 文档

- [产品需求文档](docs/product/PRD.md)
- [UI 设计规范](docs/product/ui-design.md)
- [EPUB 兼容性附录](docs/product/epub-compatibility.md)
- [技术设计](docs/superpowers/specs/2026-06-18-scope-reader-design.md)

## 隐私与安全

EPUB 和其他图书文件均视为不可信输入。首版将禁用出版物脚本与远程资源，限制解压规模，并隔离内容渲染。除非未来由用户明确选择云能力，图书文件不会离开浏览器。

## 许可证

项目许可证尚未确定。在许可证明确前，请勿假定代码或文档可用于再分发。
