# PRD：刷新消息导航改为软刷新

> **状态**：done（Violet stamps 已落地）。  
> **优先级**：P1。  
> **范围**：ChatGPT 底栏「刷新消息导航」。不新增 HTML 解析器，仍走 PageIndex / Discovery。

## 问题

底栏刷新目前用空的 `?message=` 做 `location.assign`，整页重载，迫使 ChatGPT 重建官方导航骨架，对话状态被丢掉。

## 行为

1. **默认软刷新**。点击「刷新消息导航」只重扫已经挂载的 DOM：`pageIndex.invalidate()` + `surface.refreshSurface()`。沿用现有 round / directory projection，只重算消息导航和目录大纲。不重载页面，不丢对话状态。
2. **补不上的空洞**。投影里的轮次没有挂载锚点，或官方导航骨架的条数多于当前挂载条数（虚拟化消息还没挂上）时，提示用户稍微滚动后再刷新。Toast 上提供次要操作「仍可整页刷新」/ Full page refresh，才走原来的空 `?message=` 整页刷新。整页刷新不是默认。
3. 不新写解析器。空洞判断只读 Surface 帧和现有 `readChatGPTOfficialNavigation`。

## 非目标

- 不改书签跨会话跳转仍使用的 `?message=` 导航。
- 不在软刷新里重抓全文或替换内容池。
