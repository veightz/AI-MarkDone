# PRD：阅读器宽屏选项

## 问题

阅读器内容固定偏窄，两侧留白过多（用户截图用红框标出两侧空白）。

## 目标

参照**飞书文档**类体验：提供宽屏选项（加宽 / 铺满可切换），默认不要锁死窄栏。

## 验收

- [ ] 有明确切换入口（类似飞书文档宽度控制）
- [ ] 至少支持「较宽 / 铺满」之一，相对现状明显少留白
- [ ] 偏好可持久化（刷新后记住）优先；若首版不做持久化需在 PRD 注解

## 非目标

入口/跟随视口见 `09-29-reader-follow-viewport`（已合并原入口统一）；本单只做宽度，且排在其后。

## 决策：Lite（油猴）是否包含宽屏 — ✅ 已定：包含（2026-10-10，User 拍板）

- 页面宽度：右下 **↔ 宽度** 按钮 / Lite 菜单，标准 → 较宽（≤1200px）→ 铺满；`GM_setValue`（回退 `localStorage`）键 `mdlitePageWidth`；`html[data-mdlite-width]` + 样式规则，SPA 切换 / 重渲染后由 watchdog 补回。
- 选择器沿用扩展 `ChatGPTPageWidthController`（`max-w-(--thread-content-max-width)` 等），同时覆盖 `--thread-content-max-width` 变量。
- Lite 阅读器侧栏自身宽度：头部「宽度·标准/较宽/铺满」，键 `mdliteReaderWidth`。
- 扩展端阅读器宽屏仍按本单原排期，不受影响。
