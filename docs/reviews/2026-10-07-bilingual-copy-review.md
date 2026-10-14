# AI-MarkDone 升级：需要维护者把关的内容

状态：本地实施、自动检查与组件浏览器验收已完成。以下长文和产品承诺待维护者审阅；尚未发布。

普通按钮、字段提示、短状态和错误反馈已自主完成。下面按六组集中审阅产品立场、个人表达和保存承诺；无需逐个审批普通标签。

本轮逐条审阅原有中英文各 1,370 个条目，修改 354 个既有 key，并新增 25 个 key，当前每语 1,395 个条目。逐条记录包含保留项，主清单只要求确认下面的实际决定。

## 1. 产品名称与一句话介绍

确认商店标题是否应突出阅读与导出，以及功能排列是否符合你希望用户首先记住的价值。

**extName**

- 中文：AI-MarkDone — ChatGPT 阅读与导出
- English: AI-MarkDone — Reader and export for ChatGPT

**extDescription**

- 中文：阅读 ChatGPT 回复、添加注释、保存书签，并导出为 Markdown、PDF 或 PNG。
- English: Read, annotate, bookmark, and export ChatGPT replies as Markdown, PDF, or PNG.

## 2. 首次使用与功能边界

确认第一次打开时应引导用户进入 ChatGPT 回复工具栏，还是先进入资料库/设置；当前文案已给出这两条入口。当前代码没有新建额外引导流程。

**popupChatGptHint**

- 中文：阅读回复、添加注释、保存书签和导出
- English: Read, annotate, bookmark, and export replies

**popupUnsupportedPageFooter**

- 中文：打开 ChatGPT 后即可使用回复下方的工具栏；点击插件图标可打开资料库与设置。
- English: Open ChatGPT and use the toolbar below a reply. Click the extension icon for Library and Settings.

**chatgptInputEnhancementGuideIntro**

- 中文：编辑时会显示 Markdown 标记。可在“输入增强”中分别调整各项功能。
- English: Markdown markers remain visible while editing. Turn each option on or off under Input enhancement.

## 3. 草稿与正式注释

确认“自动保留草稿，显式保存正式注释”的产品规则，以及最近一次保存后 30 天内的恢复承诺。已验证持久会话与回复身份的目标可跨刷新恢复，无法验证身份时仅页面内恢复；目标变化可能无法自动重定位。

**readerCommentCloseKeepDraft**

- 中文：关闭并保留草稿
- English: Close and keep draft

**readerCommentDraftSaved**

- 中文：草稿已保存在此浏览器
- English: Draft saved in this browser

**readerCommentDraftSessionOnly**

- 中文：草稿仅保留在当前页面
- English: Draft kept for this page session

**readerCommentDraftConflict**

- 中文：草稿已在另一个窗口中更改。当前输入仍在，请复制后再重新打开。
- English: This draft changed in another window. Your text is still here; copy it before reopening.

**readerCommentDraftLimit**

- 中文：草稿过长或存储已满。当前输入仍在，请复制或保存为注释。
- English: The draft is too long or storage is full. Your text is still here; copy it or save the annotation.

## 4. 数据、备份与删除范围

重点确认资料库备份、设置文件、Drive 手动备份和删除范围的表达。正式注释保存仍按原有偏好；草稿不进入资料库备份。Drive 退出仅说明断开连接，不保证 Google 端授权撤销成功。

**settingsExportNotice**

- 中文：JSON 文件包含按钮显示与固定偏好、外观、阅读和导出设置；不含资料库内容、对话、提示词、自定义模板、账号信息或凭据。请存放在可信的位置。
- English: The JSON file includes button visibility, pinned buttons, appearance, reading, and export preferences. It excludes Library content, conversations, prompts, custom templates, account details, and credentials. Store it somewhere you trust.

**saveContextOnlyConfirm**

- 中文：新书签只保存摘要？超过 500 个字符的提问和回复将分别保留开头 250 和结尾 250 个字符。
- English: Save only excerpts in new bookmarks? Questions and replies longer than 500 characters will keep 250 from the start and 250 from the end.

**pageAnnotationDeleteAllFinalMessage**

- 中文：这些注释将从此浏览器中永久删除。
- English: These annotations will be permanently deleted from this browser.

**communityPrivacyNote**

- 中文：加群完全自愿，其他成员可能看到你的公开资料；也可以通过我的小红书主页加入群聊。
- English: Joining is optional. Other members may see your public profile. You can also join through my Xiaohongshu profile.

## 5. 长篇帮助与操作说明

通读新的中英文 FAQ；重点看独立阅读器的原标签页依赖、内容规则、复制代码的边界和加权字符计数是否容易理解。历史更新日志和用户自定义提示词/模板未改。

## 6. 作者介绍、其他产品与自愿赞助

确认第一人称经历、当前身份、个人项目口吻和赞助表达。社区邀请日期原为 2026-08-14，现已明确过期；需要你提供新邀请后才能更新二维码/链接。

**aboutProfileBio**

- 中文：我是一名工科研究生，平时喜欢探索各种 AI 工具。
- English: I am an engineering graduate student who enjoys exploring AI tools in my spare time.

**aboutHeroTitle**

- 中文：从日常 ChatGPT 使用需求出发
- English: Built for everyday ChatGPT tasks

**aboutHeroDesc**

- 中文：AI-MarkDone 是一个个人项目，帮助你阅读、整理和复用较长的 ChatGPT 对话。
- English: AI-MarkDone is a personal project that helps you read, organize, and reuse long ChatGPT conversations.

**sponsorOpenSourceBody**

- 中文：如果 AI-MarkDone 对你有帮助，欢迎在 GitHub 点亮 Star，让更多人发现它。
- English: If AI-MarkDone is useful to you, a GitHub star helps others find the project.

**sponsorDonateBody**

- 中文：如果愿意支持 AI-MarkDone，可以选择下方方式，自愿赞助开发。
- English: If you would like to support AI-MarkDone, choose one of the options below. Contributions are optional.

**communityXiaohongshuMeta**

- 中文：此邀请已于 2026 年 8 月 14 日过期
- English: This invite expired on August 14, 2026

### 好友迹卡片

请核对另一个产品的定位、本地保存和隐私承诺；这些描述未在本轮修改该产品代码或进行产品验收。

**mappamoryHeroDesc**

- 中文：好友迹是一款 iPhone 好友地图通讯录。把人物、地点和记录放在同一张地图里，以后可以从地图或人物页重新找到它们。
- English: Mappamory is a map-based contacts app for iPhone. Save the places connected to people you care about, then return through the map or a person’s profile.

**mappamoryFeatureLocalDesc**

- 中文：无需注册账号。数据默认保存在你的 iPhone 上，并支持本地导出、备份、预览和恢复。
- English: No account is required. Your data stays on your iPhone by default, with local export, backup, preview, and restore when you need them.

**mappamoryPrivacyDesc**

- 中文：好友迹只保存你主动选择、用于个人记录的地点。它不是实时定位服务，也不会追踪其他人。
- English: Mappamory saves the places you choose for your own records. It is not a live-location service and does not track other people.

## 长文的完整最终版本

- [常见问题（中文）](../../src/ui/content/bookmarks/content/faq.zh.md)
- [FAQ（English）](../../src/ui/content/bookmarks/content/faq.en.md)
- [关于作者（中文）](../../src/ui/content/bookmarks/content/about.zh.md)
- [About the author（English）](../../src/ui/content/bookmarks/content/about.en.md)

## 已完成的文案原则

动作优先、相同概念用相同术语、英文 sentence case、中文自然表达、错误提供可执行的下一步、保存/备份/关闭的边界准确。写作规则见 [WRITING.md](../WRITING.md)。参考 [Apple Writing](https://developer.apple.com/design/human-interface-guidelines/writing) 与 [Shopify Content](https://shopify.dev/docs/apps/design/content)。

## 验证边界

自动测试、构建、组件浏览器和安装后真实 ChatGPT 验收分别记录在实施计划中。目录失败提示不等于已经修复 James 的 Safari 现场问题；未知宿主代码结构仍需取得实际页面样例验证。
