# AI-MarkDone 6.2.0 商店发布文案

准备日期：2026-10-12（Asia/Shanghai）。用户决定：Chrome 和 Firefox 都准备材料；本轮实机验收只覆盖 Chrome，Firefox 保留构建验证。暂不合并 main，也不上传。

## 名称与简述

名称和简述沿用 `public/_locales/*/messages.json`，与安装包保持一致。

| 字段 | 中文 | English |
| --- | --- | --- |
| 名称 | AI-MarkDone — ChatGPT 阅读与导出 | AI-MarkDone — Reader and export for ChatGPT |
| 简述 | 阅读 ChatGPT 回复、添加注释、保存书签，并导出为 Markdown、PDF 或 PNG。 | Read, annotate, bookmark, and export ChatGPT replies as Markdown, PDF, or PNG. |

## 两个商店共用的中文详细介绍

```text
大家好，我是一名工科研究生，平时经常用 ChatGPT 阅读和写作。AI-MarkDone 是我从这些日常需要里慢慢做起来的：长对话里找回复、复制公式和代码、留下修改意见，以及把有用的内容保存下来。

装好后刷新 ChatGPT，就可以从回复下方的工具栏开始使用。

阅读与导航
用右侧消息目录查找回复、预览内容，或用阅读器查看长文、表格、代码和公式。阅读器有标题大纲，也能把几个片段暂放在摘录区，方便对照。

复制与导出
复制整条回复或选中的 Markdown 片段，点击公式复制 LaTeX。选中的消息可以保存为 Markdown、PDF 或 PNG；支持的图表和卡片可随 Markdown 保存成带图片附件的离线 ZIP。无法保留的内容会有文字说明，离线文件不保留网页交互。

注释与高亮
选中原文写意见，或用高亮标记重点。注释窗口可以拖动、最小化和展开，点击框外不会关闭。原文、注释和提示词可以整理到输入框里，检查后再继续提问。

书签与资料库
保存对话链接，或保存当时的提问和回复。书签、注释和高亮可以按文件夹整理、搜索，并导出到本地文件。Google Drive 备份是实验性功能，需要手动发起，不会自动同步。

输入与设置
复用常用提示词，使用公式预览和 LaTeX 片段，按自己的习惯调整按钮、字号、主题和主色。想了解更多入口，可以打开插件内的“功能全览”。

保存规则
高亮自动保存到当前浏览器。“保存新建的注释”默认关闭，开启后新注释可在刷新后继续查看；已有保存的注释不受开关影响。注释只在点击“保存”后提交，主动关闭或刷新页面会丢弃未保存的修改。摘录区在刷新页面后清空。

AI-MarkDone 免费、开源，围绕 ChatGPT 开发，提供 Chrome 和 Firefox 版本。感谢每一位提供反馈的朋友。

使用手册：https://zhaoliangbin42.github.io/ai-markdone/manual/
问题反馈：https://github.com/zhaoliangbin42/AI-MarkDone/issues
邮箱：zhaoliangbin42@gmail.com
```

## Shared English description

```text
I'm an engineering graduate student, and I use ChatGPT often for reading and writing. AI-MarkDone grew out of everyday needs: finding an earlier reply, copying formulas and code, leaving revision notes, and keeping useful content.

Install it, refresh ChatGPT, and start with the toolbar below a reply.

Reading and navigation
Find and preview replies with the message directory, or read long answers, tables, code and formulas in Reader. Use the heading outline to move around, and keep a few passages in the Excerpt tray for comparison.

Copying and exports
Copy a whole reply or selected Markdown, and click formulas to copy LaTeX. Save selected messages as Markdown, PDF or PNG. Supported charts/cards can be saved in an offline Markdown ZIP with image attachments. Unavailable content keeps a text explanation; offline files do not retain interactive controls.

Annotations and highlights
Select a passage to write a note or highlight it. The annotation window can be dragged, minimized and expanded, and stays open when you click outside. Bring passages, annotations and a reusable prompt into the input box, review them, then send your follow-up yourself.

Bookmarks and Library
Save conversation links or a question and reply as they were when saved. Search and organize bookmarks, annotations and highlights in folders, or export them to a local file. Experimental Google Drive backup is manual, not automatic synchronization.

Input and settings
Reuse prompts, preview formulas and call up LaTeX snippets. Adjust buttons, font size, theme and accent color. Feature overview explains the tools and where to find them.

Saving behavior
Highlights save in the current browser. Save new annotations is off by default; turn it on to keep new annotations after refreshes. Previously saved annotations are unaffected. Annotations submit only when you choose Save; closing the editor or refreshing discards unsaved edits. Refreshing clears the Excerpt tray.

AI-MarkDone is free and open source, developed for ChatGPT, with Chrome and Firefox builds. Thanks to everyone who shares feedback.

User manual: https://zhaoliangbin42.github.io/ai-markdone/en/manual/
Report an issue: https://github.com/zhaoliangbin42/AI-MarkDone/issues
Email: zhaoliangbin42@gmail.com
```

## Chrome 6.2.0 更新摘要

适用于从 6.1.0 升级；完整版和感谢名单以 `RELEASE_NOTES.md` 的 6.2.0 为准。

```text
6.2.0 完善了注释、复制和导出：
- 注释窗口可拖动、最小化，点击框外不再关闭，点击“保存”才提交。
- 支持的图表和卡片可保存为离线 Markdown ZIP，PDF／PNG 可选图片或文字占位。
- 修复代码格式丢失、书签保存误报不可用，以及注释和高亮定位到错误段落的问题。
- 修复已确认的 PDF 空白原因、切换会话后的目录和工具栏恢复，并统一常用窗口的样式。
感谢 @qds19100、@oxwo277、@三分钟热度、@成长！的反馈。
```

```text
6.2.0 improves annotations, copying and exports:
- Move or minimize the annotation window and keep it open when clicking outside. Choose Save to submit your note.
- Save supported charts/cards in an offline Markdown ZIP; choose images or placeholders in PDF/PNG.
- Fix lost code formatting, incorrect bookmark-save failures, and annotation/highlight jumps to the wrong passage.
- Fix an identified cause of blank PDFs, restore the directory and controls after conversation switches, and unify smaller windows.
Thanks to @qds19100, @oxwo277, @三分钟热度 and @成长！ for their feedback.
```

## Firefox 6.2.0 更新摘要

核对时 Firefox 商店版本为 6.0.0，因此准备累计更新摘要，包含 6.1.0 的主要变化。本轮未做 Firefox 实机或原生打印验收；这一边界属于维护者记录，不改写成“Firefox 已通过实测”。

```text
从 6.0.0 升级到 6.2.0：
- 新的按钮设置页，可预览按钮效果并固定常用按钮；增加主题色和自定义颜色。
- 改善目录导航、发送后的阅读位置恢复，以及公式输入预览；增加功能全览和独立的阅读器设置。
- 注释窗口可拖动、最小化，点击框外不关闭，点击“保存”才提交。
- 支持的图表和卡片可保存为离线 Markdown ZIP，PDF／PNG 可选图片或文字占位。
- 修复共享链路中的代码复制、书签保存、注释与高亮定位、会话切换及 PDF 打印冲突问题。
- 统一常用窗口样式。
感谢 @qds19100、@oxwo277、@三分钟热度、@成长！及其他提供反馈的朋友。
```

```text
Updating from 6.0.0 to 6.2.0:
- Preview and pin controls in the new Buttons settings, with more theme colors and custom accents.
- Improved directory navigation, reading-position restoration after sending, and formula previews; added Feature overview and separate Reader settings.
- Move or minimize the annotation window and keep it open when clicking outside. Choose Save to submit your note.
- Save supported charts/cards in an offline Markdown ZIP; choose images or placeholders in PDF/PNG.
- Fixed shared code-copying, bookmark-save, annotation/highlight navigation, conversation-switching and PDF print-conflict paths.
- Unified smaller windows.
Thanks to @qds19100, @oxwo277, @三分钟热度, @成长！ and everyone else who shared feedback.
```

## 维护者提交信息

- Chrome 包：`release/AI-MarkDone-v6.2.0-chrome.zip`。
- Firefox 审核包：`release/AI-MarkDone-v6.2.0-firefox.zip`；本地 ZIP 不等于已签名、可长期安装的 XPI。
- 本次没有因文案调整新增权限或修改数据处理。名称、简述与 manifest 的 locale 信息一致。
- 常规安装指向各自商店。README 将 Firefox 临时加载放在开发说明中，并说明重启后失效。
- 本次没有更换公开截图素材；已有 Reader、功能全览截图与当前界面核对后继续使用。
- Chrome/Firefox 商店的长描述均应替换旧的多平台、消息折叠及“PNG 还在计划中”等过时内容。
- 对话内容、草稿、资料库备份和配置文件的说明以现有实现及 FAQ 为准；不能把手动备份描述为自动同步。

参考：
- [Chrome 商店](https://chromewebstore.google.com/detail/ai-markdone/bmdhdihdbhjbkfaaainidcjbgidkbeoh)（核对时为 6.1.0）
- [Firefox 商店](https://addons.mozilla.org/en-US/firefox/addon/ai-markdone/)（核对时为 6.0.0）
- [Firefox 临时安装说明](https://extensionworkshop.com/documentation/develop/temporary-installation-in-firefox/)
- [完整双语发布文案](../RELEASE_NOTES.md)
- [发版准备记录](AI-MarkDone-v6.2.0-PREPARATION.md)
