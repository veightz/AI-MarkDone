# PRD：MarkDone Userscript Lite（油猴）

> **状态**：in_progress（设计 + 骨架；功能逐步对齐扩展日用子集）。  
> **优先级**：P0（分发主线；CWS Unlisted 已暂停）。  
> **盖章**：Violet + User — 暂不付商店 $5；先做油猴 Lite；解压 zip 留应急。

## 问题

个人用解压 Chrome 扩展每次发版要手动「重新加载」，摩擦大。商店 Unlisted 要一次性开发者费。Sensebook 已证明：单文件油猴 + raw GitHub `@updateURL` 能自动拉新。

## 目标

1. 在 ChatGPT（`chatgpt.com` / `chat.openai.com`）提供 **Lite** 日用能力，与扩展 fork 已交付的阅读体验对齐子集。  
2. 安装方式：Tampermonkey「从 URL 安装」→ raw GitHub（同 Sensebook）。  
3. 代码策略：**薄封装 / 页内 DOM 重实现**，不拆扩展架构、不硬拽 background / Drive。

## Lite 范围（In）

| 能力 | 扩展对照 | Lite 策略 |
| --- | --- | --- |
| 视口跟随阅读器 chip | `ChatGPTViewportReaderChipController` | 页内薄实现：挂主读助手气泡；窄屏 fixed 回退 |
| 文内大纲 + 钉住 | `reader-outline-rail` + `readerOutlinePinPreference` | Lite 面板内大纲；钉住偏好用 `GM_setValue` / `localStorage` |
| 软刷新消息导航 | `softRefreshChatGPTMessageNavigation` | 不 `location.assign`；重扫已挂载助手轮次；缺洞 toast + 可选整页兜底 |

## 非目标（Out）

- Google Drive / 云备份、background service worker、`chrome.*` 消息总线  
- 完整书签库、提示词库、导出 PDF/PNG、公式资源管线、设置全页  
- 与扩展 1:1 功能或共享 Vite 多入口打包（后续可抽 chrome-free 模块，**本阶段不做**）  
- CWS Unlisted / 自托管 CRX（已暂停 / 探路过）

## 安装 URL（计划）

```
https://raw.githubusercontent.com/veightz/AI-MarkDone/main/userscript/markdone-lite.user.js
```

- `@updateURL` / `@downloadURL` 同上（Sensebook 模式）。  
- `@match`：`*://chatgpt.com/*`、`*://chat.openai.com/*`（必要时再加）。  
- `@grant`：`GM_getValue`、`GM_setValue`（钉住偏好）；尽量少 grant。

## 复用策略

1. **本阶段**：独立 `userscript/markdone-lite.user.js`（可再拆同目录小文件，仍以单入口安装为准）。从扩展 **抄选择器与行为契约**，不 import `src/`（Vite + webextension-polyfill 在油猴里不可用）。  
2. **禁止**：把 `dist-chrome/content.js` 整包塞进油猴（强依赖 `browser.runtime` / 分 chunk）。  
3. **以后（可选）**：把已证实 chrome-free 的纯函数（如 `primaryRead`、大纲解析）抽到 `packages/shared-dom` 再双端引用——**等 Lite 真机验证后再开**，本任务不预建 monorepo。

## 代码库评估摘要（阻塞）

| 模块 | 能否页内跑 | 阻塞 |
| --- | --- | --- |
| `softMessageNavigationRefresh.ts` | 逻辑几乎无 chrome；需 Surface/PageIndex | Lite 用简化 DOM 重扫代替完整 Surface |
| `readerOutlinePinPreference.ts` | 仅 `browser.storage.local` | → `GM_*` / `localStorage` |
| `ChatGPTViewportReaderChipController` | DOM + Surface 订阅 | Lite 自扫 `[data-message-author-role=assistant]` |
| `ReaderPanel.ts`（~2.7k 行） | 大量 runtime URL / lazy chunks / 设置 | Lite 用精简侧栏，不移植整面板 |
| background / Drive / bookmarks | 否 | 明确不做 |

## 验收（骨架 → 日用）

- [ ] Tampermonkey 能从 raw URL 安装并自动检查更新  
- [ ] chatgpt.com 会话页出现 Lite chip / 软刷新入口，不整页刷新为默认  
- [ ] 大纲钉住跨刷新记住（GM 或 localStorage）  
- [ ] 与扩展同开时：Lite 检测到扩展注入可退避或并排不抢（实现时再定；默认先并排、id 前缀 `mdlite-`）  
- [ ] README / docs 写清：Lite ≠ 全功能扩展  

## 仓库产物

| 产物 | 路径 |
| --- | --- |
| 油猴入口 | `userscript/markdone-lite.user.js` |
| 安装说明 | `docs/userscript-lite/INSTALL-zh.md` |
