# Scope Reader

Scope Reader 是一个完全运行在浏览器中的通用图书阅读器。项目希望用统一的书库、阅读状态和交互界面承载多种数字图书格式；当前首个实现目标是无 DRM 的 EPUB 2/3 流式排版图书。

核心界面采用类似 Google 搜索结果页（SERP）的结构：左侧是章节正文，右侧是持续可见的章节树。正文保持开放、清晰和适合长时间阅读，目录则承担定位、进度反馈与图书上下文。

## 当前状态

项目处于产品设计与工程规划阶段，尚未发布可运行版本。

首版范围：

- 完全前端运行，图书不上传服务器。
- React、TypeScript 与 Vite。
- IndexedDB 保存本地图书、阅读进度和偏好。
- 支持无 DRM 的 EPUB 2/3 流式排版。
- 不支持固定版式 EPUB，不执行 EPUB 脚本，不处理 DRM。
- epub.js 只存在于底层驱动中，可由其他实现替换。

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

- [Scope Reader PRD 与设计规范](docs/superpowers/specs/2026-06-18-scope-reader-design.md)

## 隐私与安全

EPUB 和其他图书文件均视为不可信输入。首版将禁用出版物脚本与远程资源，限制解压规模，并隔离内容渲染。除非未来由用户明确选择云能力，图书文件不会离开浏览器。

## 许可证

项目许可证尚未确定。在许可证明确前，请勿假定代码或文档可用于再分发。
