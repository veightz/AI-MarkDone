# MarkDone Lite（油猴）安装

Lite = 日用阅读子集（视口跟随阅读器、大纲钉住、软刷新消息导航）。**不是**全功能 Chrome 扩展；Drive / 书签库 / 导出等仍用解压扩展。

## 安装（Tampermonkey）

1. 浏览器安装 [Tampermonkey](https://www.tampermonkey.net/)。
2. 打开仪表盘 → **实用工具** → **从 URL 安装**，粘贴：

```
https://raw.githubusercontent.com/veightz/AI-MarkDone/main/userscript/markdone-lite.user.js
```

3. 确认安装。之后 Tampermonkey 会按 `@updateURL` 自动检查更新（同 Sensebook）。

本地调试：把仓库里的 `userscript/markdone-lite.user.js` 拖进 Tampermonkey「添加新脚本」或复制粘贴。

## 使用

- 打开 [chatgpt.com](https://chatgpt.com) 任意对话。
- **阅读器** chip：跟视口内主读助手回复；窄屏改右下角固定。
- 面板右侧大纲：📍 钉住 / 📌 动态缩放（记住上次选择）。
- 右下角 **软刷新导航**：重扫已挂载消息，默认**不**整页刷新；缺洞时可选手动「仍可整页刷新」。

## 与 Chrome 扩展并存

- Lite DOM id / class 前缀为 `mdlite-`，尽量不与扩展 `aimd-` 抢节点。
- 同开可能出现两套入口；日常可只开 Lite，应急再解压装扩展。

## 非目标

见 `.trellis/tasks/10-08-userscript-lite/prd.md`：不做 Drive、background、完整书签/提示词、商店打包。
