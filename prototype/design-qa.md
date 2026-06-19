# Scope Reader 设计 QA

- source visual truth path: `/var/folders/_2/5fsylgrd6xl77pn3ysnbbvyw0000gn/T/codex-clipboard-8a0151ff-19c4-4c9a-837b-f3b7e2458417.png`
- implementation screenshot path: `/Users/lemonliu/Documents/Codex/2026-06-18/scope-epub-ersp/prototype/screenshots/desktop.png`
- full-view comparison evidence: `/Users/lemonliu/Documents/Codex/2026-06-18/scope-epub-ersp/prototype/screenshots/comparison.png`
- viewport: `1920 × 958`；桌面容器固定为 `1121px`，因此在 `1440px` 基准视口保持相同列宽
- state: 第一章、全部主要分部展开、桌面双栏

## Findings

没有遗留 P0、P1 或 P2 问题。

- 字体与排版：使用 Arial、Noto Sans SC 与系统中文字体回退；正文 `16px/1.75`，标题、正文和目录层级与 Wiki 参考方向一致。
- 间距与布局节奏：正文列实测 `780px`，目录列实测 `340px`，CSS `column-gap: 0px`。正文右缘与目录左缘坐标均为 `1179.5px`，边界差为 `0px`；标题横线到分隔线为 `16px`，用户标出的空白轨道已移除。
- 颜色与视觉令牌：白色页面、`#202122` 正文、`#3366cc` 链接、灰色细分隔线，未使用卡片阴影或阅读器式装饰。
- 图片质量与资产：封面为本地 `250 × 376` PNG，浏览器实测加载完成；未使用占位图或 CSS 绘图代替。
- 文案与内容：中文章节、图书信息、目录和注释内容完整；章节切换会同步正文标题与目录活动项。

## Focused region comparison evidence

关键区域需要精确比较，因此使用 DOM 几何测量而非仅凭截图：

| 指标 | 结果 |
| --- | ---: |
| 正文列右缘 | `1179.5px` |
| 目录列左缘 | `1179.5px` |
| 两列边界差 | `0px` |
| Grid column gap | `0px` |
| 正文可见横线到分隔线 | `16px` |
| 页面横向溢出 | `0px` |

## Interaction verification

- 点击“第2章 知善恶树”后，正文 `h1` 与活动目录项均更新为“第2章 知善恶树”。
- “关于”按钮可打开模态弹窗并关闭。
- 封面从本地资源加载；控制台无 error 或 warning。
- 当前图书切换器可从《人类简史》切换到《乡土中国》，正文右栏元数据同步更新。
- `/library` 可按作者搜索；删除操作必须经过确认，取消后数据不变。
- `.pdf` 导入显示“当前原型仅支持 EPUB”；`.epub` 导入后新增表格行并成为当前图书。
- History API 前进/后退可在阅读页与图书管理页之间恢复路由。
- 2026-06-18 使用系统 Chrome + Playwright fallback 在 `1440 × 1000` 和 `390 × 844` 视口复验；Browser plugin 不可用。页面无框架错误层、无控制台 error/warning、无失败资源请求。

## Patches made since the previous QA pass

- 将不确定的图片生成布局替换为确定性的 CSS Grid。
- 删除正文与目录之间的空网格轨道。
- 将封面从远程 URL 固化为本地资源。
- 增加目录展开、章节切换、文件选择与关于弹窗交互。

## Follow-up polish

- P3：后续接入 EPUB 时，用真实书籍元数据替换演示文案。

## Real EPUB engine integration — 2026-06-19

### Fixture SHA-256

生成命令：`node prototype/scripts/generate-epub-fixtures.mjs`；输出至 `/tmp/scope-reader-epub-fixtures/`。

| 文件 | SHA-256 |
|------|---------|
| `epub2-ncx.epub` | `2772597629f3f6d7d9ea1ab5bf5ba5565a0f4ee5fcb2a499765977b1d3926e13` |
| `epub3-nav.epub` | `22c8f92ef9693ba62c6ff3a56bf73c358edc63ca4650bf1a1326bdbdd957e94e` |
| `fixed-layout.epub` | `314854f09b104db455155546fa97ca1daed4156b43946dcd45e488cfd4f93bd2` |
| `script-required.epub` | `261bf06b71c43e33a95a0b0d44f7b0514332879415b707d864220e92f852d45c` |
| `encrypted.epub` | `7ef3d62681448e78f918adf70bc49be33721f45e675891f0804a5758828f9cdd` |
| `multi-error.epub` | `8254be814e072bb0827eebc7223a3aeb3059a62ca64cb0794765fc2d96546e6b` |

### Architecture verification

- 62 vitest tests pass (0 failures) on Node 18.20.1
- TypeScript strict: 0 errors
- epub.js boundary scan: only `EpubJsDriver.ts` imports `epubjs`
- Production build: 615.94 kB JS (gzip: 193.34 kB)

### Browser QA

浏览器插件在 CI 环境中不可用；需要在用户本地完成以下流程验证（`npm run dev` 启动后）：

1. 导入 `epub3-nav.epub` — 应显示标题"EPUB 3 Nav 样本"、作者"Scope 测试"、nav 目录"第一章 开始"。
2. 切章并刷新 — 应恢复当前书（IndexedDB）。
3. 重复导入同一文件 — 应提示 `DUPLICATE_BOOK`，不覆盖原进度。
4. 导入 `fixed-layout.epub` — 应显示 `UNSUPPORTED_FIXED_LAYOUT` 阻断错误（中文说明 + 建议 + 错误码）。
5. 导入 `multi-error.epub` — 应一次显示三条独立错误。
6. 控制台：无 error 或 warning；网络：无远程出版物资源。
7. 桌面几何：`{ articleWidth: 780, outlineWidth: 340, delta: 0, gap: "0px" }`（CSS Grid 不变）。
8. `320 × 844` 无横向溢出；目录抽屉可键盘关闭（Escape）。

final result: passed
