import { DEFAULT_SETTINGS } from '../../../../src/core/settings/types.ts';
export const defaults = structuredClone(DEFAULT_SETTINGS);
export const groups = [
 ['appearance','外观与布局','layers','主题、字号与页面宽度。'],
 ['reading','阅读与导航','bookOpen','页面目录与 Reader。'],
 ['input','输入与 Prompt','textCursor','输入增强与提示词。'],
 ['marks','标记与注释','messageSquareText','保存、显示与输出。'],
 ['copy','复制与导出','copy','文本、公式与图片格式。'],
 ['controls','按钮与快捷键','keyboard','页面入口与键盘操作。'],
 ['data','数据与备份','database','查看保存范围，管理备份与恢复。'],
 ['advanced','高级与诊断','wrench','运行选项与诊断。'],
];
const rows=[];
const add=(group,key,label,desc,type='toggle',extra={})=>rows.push({group,key,label,desc,type,...extra});
add('appearance','proposal.theme','界面主题','跟随页面，也可以固定浅色或深色。','select',{options:[['auto','跟随页面'],['light','浅色'],['dark','深色']],initial:'light',proposal:true});
add('appearance','appearance.fontSizePx','界面字号','调整资料库、设置和扩展界面的文字。','range',{min:12,max:20,step:1,unit:'px'});
add('appearance','appearance.accentColor','主题色','沿用当前五种主题色；高亮颜色单独管理。','select',{options:[['','跟随默认'],['#2563eb','蓝色'],['#059669','绿色'],['#7c3aed','紫色'],['#e11d48','玫红'],['#d97706','琥珀'] ]});
add('appearance','chatgptBehavior.pageWidthScale','ChatGPT 页面宽度','同步调整对话正文与输入条的宽度。','range',{min:100,max:200,step:5,unit:'%'});
add('appearance','language','界面语言','切换扩展界面的显示语言。','select',{options:[['auto','跟随浏览器'],['zh_CN','简体中文'],['en','English']]});
add('reading','chatgptDirectory.enabled','页面目录','在 ChatGPT 右侧显示消息目录。');
add('reading','chatgptDirectory.mode','目录显示方式','预览模式更轻，展开模式直接展示消息标题。','select',{options:[['preview','预览'],['expanded','展开']]});
add('reading','chatgptDirectory.promptLabelMode','目录标题内容','只显示开头，或同时保留开头与结尾。','select',{options:[['head','显示开头'],['headTail','开头与结尾']]});
add('reading','chatgptDirectory.hideOfficialNavigation','隐藏 ChatGPT 官方导航','启用扩展目录时，减少重复的导航入口。');
add('reading','chatgptDirectory.rightInsetPx','目录右侧边距','调整目录与窗口右边缘的距离。','range',{min:0,max:40,step:4,unit:'px'});
add('reading','chatgptDirectory.previewMaxChars','目录悬浮预览长度','控制鼠标停留时显示的摘要长度。','range',{min:200,max:2000,step:200,unit:'字'});
add('reading','chatgptBehavior.restorePositionAfterSend','发送后保持阅读位置','发送消息后，尽量留在刚才阅读的位置。');
add('reading','reader.defaultOpenMode','Reader 打开方式','选择全屏阅读或页面内窗口。','select',{options:[['fullscreen','全屏'],['panel','窗口']]});
add('reading','reader.bodyFontSizePx','Reader 正文字号','只影响阅读器正文。','range',{min:12,max:22,step:1,unit:'px'});
add('reading','reader.contentMaxWidthPx','Reader 正文最大宽度','控制长段文字的行宽。','range',{min:480,max:1600,step:20,unit:'px'});
add('reading','reader.renderCodeInReader','渲染代码块','在 Reader 中显示代码块格式。');
add('reading','reader.showOutlineInReader','Reader 标题大纲','按标题快速浏览长回复。');
add('input','chatgptBehavior.inputEnhancement.enabled','启用输入增强','换行、加粗、列表与公式助手的统一运行开关。');
add('input','chatgptBehavior.inputEnhancement.enterKeyNewline','Enter 换行','使用 ⌘ / Ctrl + Enter 发送；输入法组合输入保持原样。');
add('input','chatgptBehavior.inputEnhancement.boldShortcut','加粗快捷键','⌘ / Ctrl + B 添加或移除可见的 ** 标记。');
add('input','chatgptBehavior.inputEnhancement.lists.enabled','智能列表','自动续写、拆分和退出列表。');
add('input','chatgptBehavior.inputEnhancement.lists.ordered','有序列表','支持 1.、2.、3. 的续写与编号。');
add('input','chatgptBehavior.inputEnhancement.lists.unordered','无序列表','支持项目符号列表的续写与退出。');
add('input','chatgptBehavior.inputEnhancement.formulaSuggestions','公式片段联想','在公式环境中输入反斜杠，查找 LaTeX 片段。');
add('input','chatgptBehavior.inputEnhancement.formulaPreview','输入公式预览','在独立浮层预览公式，不改变原始输入文字。');
add('input','chatgptBehavior.promptAutocomplete','Prompt 自动联想','输入反斜杠调出常用 Prompt；关闭后仍可手动管理。');
add('input','action.prompts','Prompt 管理','管理触发词、内容、启用状态与光标位置。','action');
add('marks','reader.persistAnnotations','保存新建注释','关闭后，新注释仅保留到页面刷新。已保存的注释不受影响。');
add('marks','chatgptBehavior.pageAnnotationsEnabled','显示页面注释','控制页面注释工具条、标记和管理入口；不会删除已保存内容。');
add('marks','reader.commentExport.promptPosition','Prompt 插入位置','注释组合文本中，Prompt 放在注释前或注释后。','select',{options:[['top','注释之前'],['bottom','注释之后']]});
add('marks','reader.commentExport.sortMode','注释输出顺序','复制与插入注释时采用同一顺序。','select',{options:[['created','创建时间'],['position','原文位置']]});
add('marks','reader.commentExport.template','注释输出模板','组合原文与注释内容，页面和 Reader 共享。','action');
add('copy','behavior.saveContextOnly','仅保存上下文','沿用现有保存范围选项；正式迁移保留首次确认机制。');
add('copy','formula.clickCopyMarkdown','点击公式复制源码','单击公式复制 LaTeX / Markdown。');
const formats=[['markdown-dollar','Markdown $ / $$'],['latex-brackets','LaTeX 括号'],['raw','纯 LaTeX'],['equation','equation 环境'],['equation-star','equation* 环境']];
add('copy','formula.clickCopyFormulaFormat','单个公式复制格式','只控制点击单个公式时的输出。','select',{options:formats});
add('copy','formula.markdownCopyFormulaFormat','全文 Markdown 公式格式','用于 Reader、工具栏、书签和选区复制。','select',{options:formats});
for(const [key,label] of [['copyPng','复制公式 PNG'],['copySvg','复制公式 SVG'],['copyMathml','复制公式 MathML'],['savePng','保存公式 PNG'],['saveSvg','保存公式 SVG']]) add('copy',`formula.assetActions.${key}`,label,'控制公式悬浮菜单中的这个动作。');
add('copy','formula.assetFontSizePx','公式图片字号','只影响单公式 PNG、SVG 和 MathML 导出。','range',{min:16,max:72,step:1,unit:'px'});
add('copy','export.pngWidthPreset','消息图片宽度','选择手机、平板、桌面或自定义宽度。','select',{options:[['mobile','手机 · 390px'],['tablet','平板 · 640px'],['desktop','桌面 · 800px'],['custom','自定义']]});
add('copy','export.pngCustomWidth','自定义图片宽度','在宽度选择“自定义”时生效。','range',{min:360,max:1200,step:20,unit:'px'});
add('copy','export.pngPixelRatio','图片导出倍率','超长图仍由现有导出器按安全预算调整实际倍率。','range',{min:1,max:3,step:0.5,unit:'×'});
for(const [key,label,desc] of [
 ['behavior.showMessageToolbar','消息工具栏','在回复的官方操作区域显示扩展按钮。'],
 ['behavior.showSaveMessages','保存消息入口','显示批量选择和导出消息的入口。'],
 ['behavior.showWordCount','字数统计','显示回复的字数信息。'],
 ['chatgptBehavior.showPageBookmarkControl','抽屉：收藏当前页面','保留页面书签的一键入口。'],
 ['chatgptBehavior.showDetachedReaderControl','抽屉：独立 Reader','在独立窗口阅读当前会话。'],
 ['chatgptBehavior.showPromptControl','抽屉：Prompt 管理','随时管理常用提示词。'],
 ['chatgptBehavior.showMessageStepper','抽屉：上一条 / 下一条','快速切换消息。'],
 ['chatgptBehavior.enableArrowKeyMessageNavigation','左右方向键切换消息','输入区之外的键盘导航。'],
 ['chatgptBehavior.showPageSelectionToolbar','选区浮动按钮','控制“复制 Markdown / 添加注释”，不关闭其他注释能力。'],
])add('controls',key,label,desc);
add('controls','chatgptBehavior.atomicMarkdownCopyShortcut','选区 Markdown 复制快捷键','独立于浮动按钮，可按自己的工具习惯配置。','select',{options:[['none','关闭'],['mod-c','⌘ / Ctrl + C'],['mod-shift-c','⌘ / Ctrl + Shift + C']]});
add('data','bookmarks.sortMode','默认书签排序','保留现有时间与标题四种排序方式。','select',{options:[['time-desc','最新优先'],['time-asc','最早优先'],['alpha-asc','标题 A → Z'],['alpha-desc','标题 Z → A']]});
add('data','action.localBackup','本地导出与导入','现有备份只覆盖书签；完整资料备份作为后续独立升级。','action');
add('data','action.drive','Google Drive 备份','现有实验性书签备份、恢复预览与合并入口。','action');
add('data','action.storage','本机存储用量','按书签、注释和高亮解释数据范围。','action');
add('advanced','platforms.chatgpt','在 ChatGPT 启用扩展','只保留 ChatGPT 的启用控制。');
add('advanced','chatgptBehavior.navigationSeekStepPx','导航搜索步长','查找尚未挂载的消息时使用；不作为保存位置。','range',{min:1000,max:5000,step:400,unit:'px'});
add('advanced','action.notice','重置 Reader 提示','再次展示独立 Reader 的说明。','action');
add('advanced','action.diagnostics','内容发现诊断','查看和复制不含正文的运行诊断。','action');
export const settingsRows=rows;
export const excludedFields={
 'version':'内部 schema 版本；不显示为设置。',
 'platforms.gemini':'遗留平台，按 ChatGPT-only 决策移出新 UI；旧字段清理另行实施。',
 'platforms.claude':'遗留平台，按 ChatGPT-only 决策移出新 UI；旧字段清理另行实施。',
 'platforms.deepseek':'遗留平台，按 ChatGPT-only 决策移出新 UI；旧字段清理另行实施。',
 'behavior.enableClickToCopy':'仅迁移/兼容输入；当前公式复制真相是 formula.clickCopyMarkdown。',
 'behavior._contextOnlyConfirmed':'内部确认状态；由确认动作维护。',
 'reader.panelSizeRatio.widthRatio':'Reader 窗口拖动后的记忆状态，非通用设置条目。',
 'reader.panelSizeRatio.heightRatio':'Reader 窗口拖动后的记忆状态，非通用设置条目。',
 'reader.detachedNoticeConfirmed':'内部提示确认状态；高级设置提供重置动作。',
 'reader.commentExport.prompts':'旧设置与 Reader 兼容字段；当前 Prompt library 有独立持久化及管理器，不创建第二套编辑器。',
 'chatgptBehavior.inputEnhancement.available':'原入口可用性同时参与 available && enabled 运行门控；迁移时合并为有效运行状态，保留所有子项，不能只删除 UI 而重新开启旧关闭用户。',
};
