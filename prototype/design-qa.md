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

## Patches made since the previous QA pass

- 将不确定的图片生成布局替换为确定性的 CSS Grid。
- 删除正文与目录之间的空网格轨道。
- 将封面从远程 URL 固化为本地资源。
- 增加目录展开、章节切换、文件选择与关于弹窗交互。

## Follow-up polish

- P3：后续接入 EPUB 时，用真实书籍元数据替换演示文案。

final result: passed
