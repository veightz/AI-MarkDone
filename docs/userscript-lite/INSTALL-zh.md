# MarkDone Lite（油猴）安装

Lite = 日用阅读子集（视口跟随阅读器、大纲钉住、页面宽度、软刷新消息导航）。**不是**全功能 Chrome 扩展；Drive / 书签库 / 导出等仍用解压扩展。

## 安装（Tampermonkey）

1. 浏览器安装 [Tampermonkey](https://www.tampermonkey.net/)。
2. 打开仪表盘 → **实用工具** → **从 URL 安装**，粘贴：

```
https://raw.githubusercontent.com/veightz/AI-MarkDone/main/userscript/markdone-lite.user.js
```

3. 确认安装。之后 Tampermonkey 会按 `@updateURL` 自动检查更新（同 Sensebook）。

本地调试：把仓库里的 `userscript/markdone-lite.user.js` 拖进 Tampermonkey「添加新脚本」或复制粘贴。

## 使用

打开 [chatgpt.com](https://chatgpt.com) 任意对话，右下角会有一排三个按钮：

| 按钮 | 作用 |
| --- | --- |
| **📖 阅读器** | 在右侧侧栏打开「当前正在读的那条」助手回复（视口里的主读回复；找不到就用最后一条）。 |
| **↔ 宽度·标准** | 页面宽度。每点一次切换：**标准 → 较宽（最多约 1200px）→ 铺满**。会记住，刷新 / 切换对话后仍生效。 |
| **Lite ☰** | Lite 菜单：阅读器、大纲钉住开关、宽度三选一（标准 / 较宽 / 铺满）、软刷新导航；底部显示版本号和「检测到 N 条助手回复」。 |

各功能：

- **阅读器 chip（📖 阅读器）**：滚动对话时，跟着视口里正在读的那条助手回复出现在它右上角；窄屏（< 720px）改为固定在右下按钮上方。点它 = 打开侧栏阅读器。
- **侧栏阅读器**：顶部「宽度·标准 / 较宽 / 铺满」切换阅读器自身宽度（也会记住）；「关闭」或按 `Esc` 关闭。
- **大纲钉住**：阅读器右侧是这条回复的大纲（标题 / 编号段落），点条目跳转。📍 = 悬停才展开，📌 = 钉住常显；也可在 Lite 菜单里切换。记住上次选择。
- **软刷新导航**（Lite 菜单里）：重扫已挂载消息，默认**不**整页刷新；缺洞时 toast 里可选「仍可整页刷新」。

排错：如果菜单底部显示「检测到 0 条助手回复」或「未找到宽度容器」，说明 ChatGPT 页面结构又变了，截图（含菜单）发回来即可。

## 与 Chrome 扩展并存

- Lite DOM id / class 前缀为 `mdlite-`，尽量不与扩展 `aimd-` 抢节点。
- 同开可能出现两套入口；日常可只开 Lite，应急再解压装扩展。

## 非目标

见 `.trellis/tasks/10-08-userscript-lite/prd.md`：不做 Drive、background、完整书签/提示词、商店打包。
