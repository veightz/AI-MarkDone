# 设置字段全量盘点

2026-09-12。根据当前 DEFAULT_SETTINGS 读取默认值；UI 按分类与搜索组织，已移除未讨论的固定、已修改筛选、密度及额外持久化开关。

共 67 个 schema 叶节点：56 个映射到设置中心，11 个为内部、兼容或遗留字段。

## 外观与布局

| 项目 | 职能 | 字段 | 默认值 / 状态 |
|---|---|---|---|
| 界面主题 | 跟随页面，也可以固定浅色或深色。 | `appearance.themeMode` | "auto" |
| 界面字号 | 调整资料库、设置和扩展界面的文字。 | `appearance.fontSizePx` | 16 |
| 主题色 | 沿用当前五种主题色；高亮颜色单独管理。 | `appearance.accentColor` | null |
| ChatGPT 页面宽度 | 同步调整对话正文与输入条的宽度。 | `chatgptBehavior.pageWidthScale` | 100 |
| 界面语言 | 切换扩展界面的显示语言。 | `language` | "auto" |

## 阅读与导航

| 项目 | 职能 | 字段 | 默认值 / 状态 |
|---|---|---|---|
| 页面目录 | 在 ChatGPT 右侧显示消息目录。 | `chatgptDirectory.enabled` | false |
| 目录显示方式 | 预览模式更轻，展开模式直接展示消息标题。 | `chatgptDirectory.mode` | "preview" |
| 目录标题内容 | 只显示开头，或同时保留开头与结尾。 | `chatgptDirectory.promptLabelMode` | "head" |
| 隐藏 ChatGPT 官方导航 | 启用扩展目录时，减少重复的导航入口。 | `chatgptDirectory.hideOfficialNavigation` | true |
| 目录右侧边距 | 调整目录与窗口右边缘的距离。 | `chatgptDirectory.rightInsetPx` | 0 |
| 目录悬浮预览长度 | 控制鼠标停留时显示的摘要长度。 | `chatgptDirectory.previewMaxChars` | 600 |
| 发送后保持阅读位置 | 发送消息后，尽量留在刚才阅读的位置。 | `chatgptBehavior.restorePositionAfterSend` | true |
| Reader 打开方式 | 选择全屏阅读或页面内窗口。 | `reader.defaultOpenMode` | "fullscreen" |
| Reader 正文字号 | 只影响阅读器正文。 | `reader.bodyFontSizePx` | 16 |
| Reader 正文最大宽度 | 控制长段文字的行宽。 | `reader.contentMaxWidthPx` | 1000 |
| 渲染代码块 | 在 Reader 中显示代码块格式。 | `reader.renderCodeInReader` | true |
| Reader 标题大纲 | 按标题快速浏览长回复。 | `reader.showOutlineInReader` | true |

## 输入与 Prompt

| 项目 | 职能 | 字段 | 默认值 / 状态 |
|---|---|---|---|
| 启用输入增强 | 换行、加粗、列表与公式助手的统一运行开关。 | `chatgptBehavior.inputEnhancement.enabled` | true |
| Enter 换行 | 使用 ⌘ / Ctrl + Enter 发送；输入法组合输入保持原样。 | `chatgptBehavior.inputEnhancement.enterKeyNewline` | true |
| 加粗快捷键 | ⌘ / Ctrl + B 添加或移除可见的 ** 标记。 | `chatgptBehavior.inputEnhancement.boldShortcut` | true |
| 智能列表 | 自动续写、拆分和退出列表。 | `chatgptBehavior.inputEnhancement.lists.enabled` | true |
| 有序列表 | 支持 1.、2.、3. 的续写与编号。 | `chatgptBehavior.inputEnhancement.lists.ordered` | true |
| 无序列表 | 支持项目符号列表的续写与退出。 | `chatgptBehavior.inputEnhancement.lists.unordered` | true |
| 公式片段联想 | 在公式环境中输入反斜杠，查找 LaTeX 片段。 | `chatgptBehavior.inputEnhancement.formulaSuggestions` | true |
| 输入公式预览 | 在独立浮层预览公式，不改变原始输入文字。 | `chatgptBehavior.inputEnhancement.formulaPreview` | true |
| Prompt 自动联想 | 输入反斜杠调出常用 Prompt；关闭后仍可手动管理。 | `chatgptBehavior.promptAutocomplete` | true |
| Prompt 管理 | 管理触发词、内容、启用状态与光标位置。 | `action.prompts` | 现有管理动作 |

## 标记与注释

| 项目 | 职能 | 字段 | 默认值 / 状态 |
|---|---|---|---|
| 保存新建注释 | 关闭后，新注释仅保留到页面刷新。已保存的注释不受影响。 | `reader.persistAnnotations` | false |
| 显示页面注释 | 控制页面注释工具条、标记和管理入口；不会删除已保存内容。 | `chatgptBehavior.pageAnnotationsEnabled` | true |
| Prompt 插入位置 | 注释组合文本中，Prompt 放在注释前或注释后。 | `reader.commentExport.promptPosition` | "top" |
| 注释输出顺序 | 复制与插入注释时采用同一顺序。 | `reader.commentExport.sortMode` | "created" |
| 注释输出模板 | 组合原文与注释内容，页面和 Reader 共享。 | `reader.commentExport.template` | 结构化模板 |

## 复制与导出

| 项目 | 职能 | 字段 | 默认值 / 状态 |
|---|---|---|---|
| 仅保存上下文 | 沿用现有保存范围选项；正式迁移保留首次确认机制。 | `behavior.saveContextOnly` | false |
| 点击公式复制源码 | 单击公式复制 LaTeX / Markdown。 | `formula.clickCopyMarkdown` | true |
| 单个公式复制格式 | 只控制点击单个公式时的输出。 | `formula.clickCopyFormulaFormat` | "markdown-dollar" |
| 全文 Markdown 公式格式 | 用于 Reader、工具栏、书签和选区复制。 | `formula.markdownCopyFormulaFormat` | "markdown-dollar" |
| 复制公式 PNG | 控制公式悬浮菜单中的这个动作。 | `formula.assetActions.copyPng` | false |
| 复制公式 SVG | 控制公式悬浮菜单中的这个动作。 | `formula.assetActions.copySvg` | false |
| 复制公式 MathML | 控制公式悬浮菜单中的这个动作。 | `formula.assetActions.copyMathml` | false |
| 保存公式 PNG | 控制公式悬浮菜单中的这个动作。 | `formula.assetActions.savePng` | false |
| 保存公式 SVG | 控制公式悬浮菜单中的这个动作。 | `formula.assetActions.saveSvg` | false |
| 公式图片字号 | 只影响单公式 PNG、SVG 和 MathML 导出。 | `formula.assetFontSizePx` | 36 |
| 消息图片宽度 | 选择手机、平板、桌面或自定义宽度。 | `export.pngWidthPreset` | "desktop" |
| 自定义图片宽度 | 在宽度选择“自定义”时生效。 | `export.pngCustomWidth` | 800 |
| 图片导出倍率 | 超长图仍由现有导出器按安全预算调整实际倍率。 | `export.pngPixelRatio` | 1 |

## 按钮与快捷键

| 项目 | 职能 | 字段 | 默认值 / 状态 |
|---|---|---|---|
| 消息工具栏 | 在回复的官方操作区域显示扩展按钮。 | `behavior.showMessageToolbar` | true |
| 保存消息入口 | 显示批量选择和导出消息的入口。 | `behavior.showSaveMessages` | true |
| 字数统计 | 显示回复的字数信息。 | `behavior.showWordCount` | true |
| 抽屉：收藏当前页面 | 保留页面书签的一键入口。 | `chatgptBehavior.showPageBookmarkControl` | true |
| 抽屉：独立 Reader | 在独立窗口阅读当前会话。 | `chatgptBehavior.showDetachedReaderControl` | true |
| 抽屉：Prompt 管理 | 随时管理常用提示词。 | `chatgptBehavior.showPromptControl` | true |
| 抽屉：上一条 / 下一条 | 快速切换消息。 | `chatgptBehavior.showMessageStepper` | true |
| 左右方向键切换消息 | 输入区之外的键盘导航。 | `chatgptBehavior.enableArrowKeyMessageNavigation` | true |
| 选区浮动按钮 | 控制“复制 Markdown / 添加注释”，不关闭其他注释能力。 | `chatgptBehavior.showPageSelectionToolbar` | true |
| 选区 Markdown 复制快捷键 | 独立于浮动按钮，可按自己的工具习惯配置。 | `chatgptBehavior.atomicMarkdownCopyShortcut` | "mod-shift-c" |

## 数据与备份

| 项目 | 职能 | 字段 | 默认值 / 状态 |
|---|---|---|---|
| 默认书签排序 | 保留现有时间与标题四种排序方式。 | `bookmarks.sortMode` | "alpha-asc" |
| 本地导出与导入 | 现有备份只覆盖书签；完整资料备份作为后续独立升级。 | `action.localBackup` | 现有管理动作 |
| Google Drive 备份 | 现有实验性书签备份、恢复预览与合并入口。 | `action.drive` | 现有管理动作 |
| 本机存储用量 | 按书签、注释和高亮解释数据范围。 | `action.storage` | 现有管理动作 |

## 高级与诊断

| 项目 | 职能 | 字段 | 默认值 / 状态 |
|---|---|---|---|
| 在 ChatGPT 启用扩展 | 只保留 ChatGPT 的启用控制。 | `platforms.chatgpt` | true |
| 导航搜索步长 | 查找尚未挂载的消息时使用；不作为保存位置。 | `chatgptBehavior.navigationSeekStepPx` | 3000 |
| 重置 Reader 提示 | 再次展示独立 Reader 的说明。 | `action.notice` | 现有管理动作 |
| 内容发现诊断 | 查看和复制不含正文的运行诊断。 | `action.diagnostics` | 现有管理动作 |

## 内部与遗留字段

| 字段 | 去向 |
|---|---|
| `version` | 内部 schema 版本；不显示为设置。 |
| `platforms.gemini` | 遗留平台，按 ChatGPT-only 决策移出新 UI；旧字段清理另行实施。 |
| `platforms.claude` | 遗留平台，按 ChatGPT-only 决策移出新 UI；旧字段清理另行实施。 |
| `platforms.deepseek` | 遗留平台，按 ChatGPT-only 决策移出新 UI；旧字段清理另行实施。 |
| `behavior.enableClickToCopy` | 仅迁移/兼容输入；当前公式复制真相是 formula.clickCopyMarkdown。 |
| `behavior._contextOnlyConfirmed` | 内部确认状态；由确认动作维护。 |
| `reader.panelSizeRatio.widthRatio` | Reader 窗口拖动后的记忆状态，非通用设置条目。 |
| `reader.panelSizeRatio.heightRatio` | Reader 窗口拖动后的记忆状态，非通用设置条目。 |
| `reader.detachedNoticeConfirmed` | 内部提示确认状态；高级设置提供重置动作。 |
| `reader.commentExport.prompts` | 旧设置与 Reader 兼容字段；当前 Prompt library 有独立持久化及管理器，不创建第二套编辑器。 |
| `chatgptBehavior.inputEnhancement.available` | 原入口可用性同时参与 available && enabled 运行门控；迁移时合并为有效运行状态，保留所有子项，不能只删除 UI 而重新开启旧关闭用户。 |

## 额外核对

- Prompt library 为独立持久化与管理器，不重新编辑旧 prompts 字段。
- Reader 窗口比例、阅读位置、Sticky、发送草稿属于现有 runtime/session 状态，不额外增加设置条目。
- 原有主题跟随页面；独立浅/深色为本轮已要求设计的能力。
- 书签当前文件夹/搜索/预览/选择属于视图状态。
- 现有本地与 Google Drive 备份只包含书签，完整资料备份不纳入本轮。
- 目录代码默认关闭，与旧文档部分默认开启描述存在漂移，尚未修改实际默认值。
