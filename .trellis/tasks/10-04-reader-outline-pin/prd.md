# PRD：阅读器右侧大纲钉住 / 动态缩放

> **状态**：done（Violet stamps 已落地）。  
> **优先级**：P1。  
> **范围**：页内阅读器结构大纲（`reader-outline-rail`），不是 ChatGPT 页目录侧轨（`ChatGPTDirectoryRail`）。

## 问题

阅读器右侧浮动大纲（H1/H2/H3 与编号条目）默认在 hover / focus 时展开，指针离开后缩回刻度条，避免挡住正文。长文对照目录时，滚动正文会让展开态收起，无法常驻。

## 行为

一个钉图标开关，两种状态：

1. **动态（默认）**：保持现有收缩 / 浮层 / 自动收起。不挡住阅读。
2. **钉住 / 常驻**：展开后在滚动阅读器正文时保持打开，不自动收起。再点一次回到动态。

- 开关在大纲面板头部。钉住时按钮为选中态（主色底 + `aria-pressed=true`）。
- 无保存记录时为动态。
- 上次选择写入扩展 `storage.local`（`aimdReaderOutlinePinned`）。
- 文案：动态时 tooltip/aria 为「钉住大纲」/ Pin outline；钉住时为「动态缩放」/ Dynamic scale。

## 非目标

- 不改 ChatGPT 目录侧轨的折叠。
- 不把该偏好写入同步的 AppSettings（避免 settings schema 迁移）。
