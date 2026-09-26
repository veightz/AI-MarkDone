// PROTOTYPE ONLY. Three workspace structures share scratch data, never extension storage.
import { Icons } from '../../../../src/assets/icons.ts';
import { settingsRows, groups, defaults } from './settings-data.js';
import { Glyphs } from './icons/glyphs.js';
const icon=(name)=>Glyphs[name]||Icons[name]||Glyphs.fileText;
const esc=(v)=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const btn=(label,action,cls='button',ico='',extra='')=>`<button class="${cls}" data-action="${action}" ${extra}>${ico?icon(ico):''}${label}</button>`;
const ib=(label,action,ico,extra='')=>btn('',action,'icon-btn',ico,`aria-label="${label}" title="${label}" ${extra}`);
const get=(obj,path)=>path.split('.').reduce((o,k)=>o?.[k],obj);
const initialValues=Object.fromEntries(settingsRows.map(r=>[r.key,r.initial??get(defaults,r.key)]));
const values=structuredClone(initialValues);
const TYPES={bookmark:['书签','bookmark'],annotation:['注释','messageSquareText'],highlight:['高亮','brush']};

const samples=[
{id:'b1',kind:'bookmark',title:'为长期阅读建立一套轻量系统',quote:'把值得重读的内容保留下来，比收集更多内容更重要。一套好的阅读系统，应当降低找回信息的成本。',conversation:'设计一套轻量知识系统',folder:'设计与产品',state:'ready',date:9,time:'今天 14:32',subtype:'整段回复'},
{id:'h1',kind:'highlight',title:'设计一套轻量知识系统',quote:'最好的工具，会在你需要它的时候出现，其余时间安静地退到一旁。',color:'yellow',conversation:'设计一套轻量知识系统',folder:'设计与产品',state:'ready',date:8,time:'今天 14:28'},
{id:'a1',kind:'annotation',title:'让“找回来”成为体验的一部分',quote:'信息的价值，不仅在于被保存，更在于能够在正确的时刻被重新找到。',comment:'这里可以作为资料库的设计原则：搜索优先，同时保留按会话回看的路径。',conversation:'设计一套轻量知识系统',folder:'设计与产品',state:'ready',date:7,time:'今天 14:20'},
{id:'h2',kind:'highlight',title:'阅读中的注意力与节奏',quote:'让界面留一点呼吸的空间，也让思考有停留的余地。',color:'blue',conversation:'阅读中的注意力与节奏',folder:'阅读笔记',state:'pending',date:6,time:'昨天 21:10'},
{id:'b2',kind:'bookmark',title:'ChatGPT 长文写作工作流',quote:'从提纲到初稿，再到逐段修改。把讨论、证据和最后的定稿分开保留，便于回溯每一次选择。',conversation:'ChatGPT 长文写作工作流',folder:'写作素材',state:'ready',date:5,time:'昨天 16:45',subtype:'整个会话'},
{id:'a2',kind:'annotation',title:'用简洁的语言解释一个观点',quote:'温和的背景与清晰的文字，可以同时存在。',comment:'这段可以再补充一个日常生活中的例子。',conversation:'阅读中的注意力与节奏',folder:'设计与产品',state:'ready',date:4,time:'昨天 16:32'},
{id:'h3',kind:'highlight',title:'ChatGPT 长文写作工作流',quote:'每次阅读之后，只保存一两条真正有用的结论。',color:'red',conversation:'ChatGPT 长文写作工作流',folder:'写作素材',state:'unlocated',date:3,time:'9 月 9 日'},
{id:'b3',kind:'bookmark',title:'CSS 自定义高亮与文字选择',quote:'将文字的语义位置与页面几何位置分开处理。高亮是一种视图，持久化的是目标与证据。',conversation:'网页标记的技术选择',folder:'设计与产品',state:'pending',date:2,time:'9 月 8 日',subtype:'整段回复'},
{id:'h4',kind:'highlight',title:'网页标记的技术选择',quote:'先整理论点，再补充例子，最后检查语句是否通顺。',color:'blue',conversation:'网页标记的技术选择',folder:'阅读笔记',state:'ready',date:1,time:'9 月 8 日'},
];
const demoText={
 'message-design-01':'最好的工具，会在你需要它的时候出现，其余时间安静地退到一旁。\n\n当我们阅读一段长回复时，最重要的不是一次保存多少内容，而是能够轻松找到当时让自己停下来的那句话。你可以给它一层温和的颜色，也可以再写下一点自己的想法。',
 'message-design-02':'先整理论点，再补充例子，最后检查语句是否通顺。\n\n把原文和自己的想法放在一起，回看时就能理解当时为什么保存它。需要更多上下文时，可以打开来源页面继续阅读。',
};
const scratchKey='AIMD_PROTOTYPE_HIGHLIGHTS_WIPE_ME_V1';
let savedHighlights=[];
try{const raw=JSON.parse(localStorage.getItem(scratchKey)||'[]');if(Array.isArray(raw))savedHighlights=raw.filter(x=>['highlight','annotation'].includes(x?.kind)&&typeof x.quote==='string'&&typeof x.id==='string'&&demoText[x.messageId]&&['blue','yellow','red'].includes(x.color));}catch{}
let records=[...structuredClone(samples).map(r=>({...r,sourceUrl:'https://chatgpt.com/'})),...savedHighlights.map(r=>({...r,sourceUrl:r.sourceUrl||location.href.split('?')[0]+'?view=demo&variant=A'}))];
const params=new URLSearchParams(location.search);
let state={view:['library','settings','demo'].includes(params.get('view'))?params.get('view'):'library',variant:'simple',theme:'light',filter:'bookmark',folder:'all',search:'',sort:'recent',category:'appearance',settingsSearch:'',selected:null,multi:false,checked:new Set(),layout:'grid',color:'yellow',drawer:true,demoSurface:'page',page:1};
const folders=['设计与产品','阅读笔记','写作素材'];
const PAGE_SIZE=20;
if(params.get('fixture')==='large'){records=Array.from({length:10000},(_,i)=>({...samples[i%samples.length],id:'fixture-'+i,title:samples[i%samples.length].title+' '+(i+1),date:10000-i,sourceUrl:'https://chatgpt.com/'}));}
let recordRevision=0, projectionCache=null;

const app=document.querySelector('#app');
const persistDemo=()=>{recordRevision++;projectionCache=null;try{localStorage.setItem(scratchKey,JSON.stringify(records.filter(x=>x.demo)));}catch{toast('演示保存失败：浏览器不允许写入本地存储。');}};
let toastTimer;
function toast(message){const el=document.querySelector('#toast');el.textContent=message;el.classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('visible'),3000);}
function syncUrl(){const u=new URL(location.href);u.searchParams.delete('variant');u.searchParams.set('view',state.view);history.replaceState(null,'',u);}
function render(){
 document.documentElement.dataset.theme=state.theme;document.body.className=`variant-${state.variant.toLowerCase()}`;
 let workspace=app.querySelector('.workspace');
 const nextViewKey=state.view==='settings'?`settings:${state.category}`:`${state.view}:${state.filter}:${state.folder}`;
 const previousViewKey=workspace?.dataset.viewKey;
 if(!workspace){
  app.innerHTML=`<section class="workspace" aria-label="AI-MarkDone 工作区">${sidebar()}<main class="main"></main></section><div id="page-drawer-root"></div>`;
  workspace=app.querySelector('.workspace');
 }
 workspace.dataset.viewKey=nextViewKey;
 workspace.querySelector('.main').innerHTML=`<div class="page-scroll">${page()}</div>${state.selected&&state.view==='library'?`<aside class="detail detail-overlay">${detail(records.find(x=>x.id===state.selected))}</aside>`:''}`;
 renderSidebar(workspace.querySelector('.library-sidebar'));
 document.querySelector('#page-drawer-root').innerHTML=state.view==='demo'?drawer():'';
 if(previousViewKey&&previousViewKey!==nextViewKey&&!matchMedia('(prefers-reduced-motion: reduce)').matches){
  workspace.querySelector('.page-scroll').animate([{opacity:.55,transform:'translateY(3px)'},{opacity:1,transform:'translateY(0)'}],{duration:160,easing:'ease-out'});
 }
 document.querySelector('#prototype-switcher').hidden=true;
 syncUrl();
}
function libraryNavigation(){return `<nav class="library-navigation" aria-label="资料类型">${[['bookmark','书签'],['annotation','注释'],['highlight','高亮']].map(([v,l])=>btn(`<span>${l}</span>`,'filter','library-nav-link',TYPES[v][1],`data-value="${v}"`)).join('')}</nav><section class="navigation-group folder-navigation"><p class="navigation-label">书签文件夹</p><nav class="library-navigation" aria-label="书签文件夹">${folders.map(f=>btn(`<span>${esc(f)}</span>`,'folder','library-nav-link folder-nav-link','folder',`data-value="${esc(f)}"`)).join('')}</nav></section>`;}
function settingsNavigation(){return `<nav class="library-navigation settings-sidebar-navigation" aria-label="设置分类">${groups.map(([id,l,i])=>btn(`<span>${l}</span>`,'category','library-nav-link settings-nav-link',i,`data-category="${id}"`)).join('')}</nav>`;}
function sidebar(){const mode=state.view==='settings'?'settings':'library';return `<aside class="library-sidebar"><div class="brand"><span class="brand-symbol">${icon('bookMarked')}</span><span>AI-MarkDone</span></div><div class="sidebar-panels" data-active="${mode}">${btn('<span>资料库</span><span class="module-chevron">'+icon('chevronDown')+'</span>','nav','sidebar-module-button','bookMarked','data-view="library" aria-controls="library-nav-panel"')}<div class="sidebar-module-panel" id="library-nav-panel"><div class="sidebar-panel-scroll">${libraryNavigation()}</div></div>${btn('<span>设置</span><span class="module-chevron">'+icon('chevronDown')+'</span>','nav','sidebar-module-button','settings','data-view="settings" aria-controls="settings-nav-panel"')}<div class="sidebar-module-panel" id="settings-nav-panel"><div class="sidebar-panel-scroll">${settingsNavigation()}</div></div></div></aside>`;}
function renderSidebar(sidebarRoot){
 const mode=state.view==='settings'?'settings':'library';
 const panel=sidebarRoot.querySelector('.sidebar-panels');
 const folderSignature=JSON.stringify(folders);
 if(sidebarRoot.dataset.folders&&sidebarRoot.dataset.folders!==folderSignature){sidebarRoot.querySelector('#library-nav-panel .sidebar-panel-scroll').innerHTML=libraryNavigation();}
 sidebarRoot.dataset.folders=folderSignature;
 panel.dataset.active=mode;
 for(const button of panel.querySelectorAll('.sidebar-module-button')){
  const expanded=button.dataset.view===mode;
  button.setAttribute('aria-expanded',String(expanded));button.classList.toggle('active',expanded);
 }
 for(const name of ['library','settings']){
  const body=sidebarRoot.querySelector(`#${name}-nav-panel`);
  body.toggleAttribute('inert',name!==mode);body.setAttribute('aria-hidden',String(name!==mode));
 }
 for(const button of sidebarRoot.querySelectorAll('.library-nav-link')){
  const active=button.dataset.action==='filter'?state.view==='library'&&state.filter===button.dataset.value&&(state.filter!=='bookmark'||state.folder==='all'):button.dataset.action==='folder'?state.view==='library'&&state.filter==='bookmark'&&state.folder===button.dataset.value:state.view==='settings'&&state.category===button.dataset.category;
  button.classList.toggle('active',active);button.setAttribute('aria-current',active?'page':'false');
 }
}
function page(){return ({library:library,settings:settings,demo:demo})[state.view]();}
function matching(){const key=[state.filter,state.folder,state.search,state.sort,recordRevision].join('|');if(projectionCache?.key===key)return projectionCache.rows;const q=state.search.toLowerCase();const rows=records.filter(r=>r.kind===state.filter&&(state.filter!=='bookmark'||state.folder==='all'||r.folder===state.folder)&&`${r.title} ${r.quote} ${r.comment||''} ${r.conversation}`.toLowerCase().includes(q));rows.sort((a,b)=>state.sort==='alpha'?a.title.localeCompare(b.title,'zh-CN'):state.sort==='alpha-desc'?b.title.localeCompare(a.title,'zh-CN'):state.sort==='old'?a.date-b.date:b.date-a.date);projectionCache={key,rows};return rows;}
function pageRecords(){const rows=matching();state.page=Math.min(state.page,Math.max(1,Math.ceil(rows.length/PAGE_SIZE)));return rows.slice((state.page-1)*PAGE_SIZE,state.page*PAGE_SIZE);}
function library(){const list=matching(),visible=pageRecords(),totalPages=Math.max(1,Math.ceil(list.length/PAGE_SIZE));return `<div class="library-heading"><div>${state.filter==='bookmark'&&state.folder!=='all'?'<p class="library-parent">书签</p>':''}<h1>${esc(state.filter==='bookmark'&&state.folder!=='all'?state.folder:TYPES[state.filter][0])}</h1></div>${ib('更多操作','library-menu','moreHorizontal')}</div><div class="toolbar"><label class="searchbox">${icon('search')}<input data-input="library-search" aria-label="搜索资料" placeholder="搜索${TYPES[state.filter][0]}" value="${esc(state.search)}"></label></div>${state.multi?`<div class="batch">${btn('选择本页','select-visible','button')}<span>已选 ${state.checked.size} 条</span><span class="spacer"></span>${state.filter==='bookmark'?btn('移动','move','button'):''}${btn('删除','delete-selected','button danger')}${ib('退出整理','batch-toggle','x')}</div>`:''}<div class="compact-list" aria-label="${TYPES[state.filter][0]}列表">${visible.map(card).join('')||empty()}</div><footer class="list-footer"><span>${list.length} 条${TYPES[state.filter][0]}</span>${totalPages>1?`<div class="pagination">${btn('','page-prev','icon-btn','chevronLeft',`aria-label="上一页" ${state.page===1?'disabled':''}`)}<span>${state.page} / ${totalPages}</span>${btn('','page-next','icon-btn','chevronRight',`aria-label="下一页" ${state.page===totalPages?'disabled':''}`)}</div>`:''}</footer>`;}

function empty(){return `<div class="empty">${icon('search')}<p>没有找到匹配的资料</p><p class="subtitle">换一个关键词，或查看全部资料。</p>${btn('清除筛选','clear-filters','button')}</div>`;}
function card(r){const title=r.kind==='highlight'?r.quote:r.title;const subtitle=r.kind==='annotation'?(r.comment||r.quote):r.kind==='highlight'?r.conversation:r.quote;return `<article class="compact-row ${state.selected===r.id?'selected':''}" data-action="record" data-id="${r.id}" role="button" tabindex="0" aria-label="查看${TYPES[r.kind][0]}：${esc(r.title)}">${state.multi?`<input class="card-selected-box" type="checkbox" aria-label="选择 ${esc(r.title)}" data-check="${r.id}" ${state.checked.has(r.id)?'checked':''}>`:`<span class="row-glyph ${r.kind==='highlight'?r.color:''}">${icon(TYPES[r.kind][1])}</span>`}<div class="row-copy"><h3>${esc(title)}</h3><p>${esc(subtitle)}</p></div><time>${r.time}</time><span class="row-arrow">${icon('chevronRight')}</span></article>`;}
function detail(r){if(!r)return '';return `<div class="detail-top"><span class="type-chip">${icon(TYPES[r.kind][1])}${TYPES[r.kind][0]}</span>${ib('关闭详情','close-detail','x')}</div><h2>${esc(r.title)}</h2><blockquote>${esc(r.quote)}</blockquote>${r.kind==='highlight'?`<div class="swatches">${swatches(r.color,'record-color',`data-id="${r.id}"`)}</div>`:''}${r.kind==='annotation'?`<label class="muted" style="font-size:11px">注释</label><textarea id="detail-note" aria-label="注释内容">${esc(r.comment||'')}</textarea>${btn('保存','save-note','button','check',`data-id="${r.id}"`)}`:''}<dl><dt>来源</dt><dd>${esc(r.conversation)}</dd>${r.kind==='bookmark'?`<dt>文件夹</dt><dd>${esc(r.folder)}</dd>`:''}<dt>保存时间</dt><dd>${r.time}</dd></dl><div class="actions"><a class="button primary" style="display:inline-flex;align-items:center;justify-content:center;gap:8px;text-decoration:none" href="${esc(r.sourceUrl||'https://chatgpt.com/')}" target="_blank" rel="noopener noreferrer">${icon('externalLink')}打开原页</a>${btn('更多','record-menu','button','moreHorizontal',`data-id="${r.id}"`)}</div>`;}
function swatches(current,action,extra=''){return ['blue','yellow','red'].map(c=>`<button class="swatch ${c} ${current===c?'active':''}" data-action="${action}" data-color="${c}" ${extra} title="${{blue:'雾蓝',yellow:'奶油黄',red:'浅珊瑚红'}[c]}" aria-label="${{blue:'雾蓝',yellow:'奶油黄',red:'浅珊瑚红'}[c]}" aria-pressed="${current===c}">${current===c?icon('check'):''}</button>`).join('');}
function filteredSettings(){const query=state.settingsSearch.toLowerCase().trim();return settingsRows.filter(r=>(query?`${r.label} ${r.desc} ${r.key} ${groups.find(g=>g[0]===r.group)?.[1]}`.toLowerCase().includes(query):r.group===state.category));}
function settings(){const rows=filteredSettings();const group=groups.find(g=>g[0]===state.category);return `<div class="page-head"><div><p class="eyebrow">PREFERENCES</p><h1>设置</h1><p class="subtitle">搜索或选择分类</p></div></div><div class="toolbar"><label class="searchbox">${icon('search')}<input aria-label="搜索全部设置" data-input="settings-search" placeholder="搜索设置，例如：换行、公式、持久化、目录…" value="${esc(state.settingsSearch)}"></label></div><div class="settings-layout"><section class="settings-content"><div class="settings-title"><div><h2>${state.settingsSearch?'搜索结果':group[1]}</h2><p class="subtitle">${state.settingsSearch?`${rows.length} 项匹配 · 跨所有分类搜索`:group[3]}</p></div></div>${state.category==='marks'&&!state.settingsSearch?'<div class="settings-preview"><span class="sample">Aa</span><span>高亮颜色：<span class="highlight-text blue">雾蓝</span>、<span class="highlight-text">奶油黄</span>、<span class="highlight-text red">珊瑚红</span>。</span></div>':''}${state.category==='appearance'&&!state.settingsSearch?'<div class="settings-preview"><span class="sample">Aa</span><span>界面预览<br><small>主题与文字</small></span></div>':''}<div class="settings-section">${rows.map(settingRow).join('')||'<div class="empty">没有匹配的设置。试试“输入”或“标记”。</div>'}</div></section></div>`;}
function settingRow(r){let control='';const v=values[r.key];const inactive=r.key.startsWith('chatgptBehavior.inputEnhancement.')&&r.key!=='chatgptBehavior.inputEnhancement.enabled'&&!values['chatgptBehavior.inputEnhancement.enabled']||r.key.startsWith('chatgptBehavior.inputEnhancement.lists.')&&r.key!=='chatgptBehavior.inputEnhancement.lists.enabled'&&!values['chatgptBehavior.inputEnhancement.lists.enabled'];
 if(r.type==='toggle')control=`<button role="switch" aria-label="${r.label}" aria-checked="${Boolean(v)}" class="toggle" data-action="toggle-setting" data-key="${r.key}" ${inactive?'disabled':''}></button>`;
 if(r.type==='select')control=`<select data-setting="${r.key}" aria-label="${r.label}">${r.options.map(([id,label])=>`<option value="${id}" ${String(v??'')===id?'selected':''}>${label}</option>`).join('')}</select>`;
 if(r.type==='range')control=`<span class="range-wrap"><input type="range" data-setting="${r.key}" aria-label="${r.label}" min="${r.min}" max="${r.max}" step="${r.step}" value="${v}"><output>${v}${r.unit}</output></span>`;
 if(r.type==='colors')control=`<div class="swatches">${swatches(v,'setting-color')}</div>`;
 if(r.type==='action')control=btn('管理','setting-action','button','chevronRight',`data-key="${r.key}"`);
 return `<div class="setting-row"><div class="setting-copy">${state.settingsSearch?`<p class="breadcrumb">设置 / ${groups.find(g=>g[0]===r.group)[1]}</p>`:''}<div class="setting-label">${r.label}</div><p>${r.desc}</p></div><div class="setting-control">${control}</div></div>`;
}
function resolveDemo(record,text){let i=text.indexOf(record.quote);const matches=[];while(i>=0){if((!record.prefix||text.slice(Math.max(0,i-record.prefix.length),i)===record.prefix)&&(!record.suffix||text.slice(i+record.quote.length,i+record.quote.length+record.suffix.length)===record.suffix))matches.push(i);i=text.indexOf(record.quote,i+Math.max(1,record.quote.length));}return matches.length===1?matches[0]:-1;}
function markedText(id){const text=demoText[id],matches=records.filter(r=>r.demo&&r.messageId===id).map(r=>({r,start:resolveDemo(r,text)})).filter(x=>x.start>=0);const points=[...new Set([0,text.length,...matches.flatMap(x=>[x.start,x.start+x.r.quote.length])])].sort((a,b)=>a-b);return points.slice(0,-1).map((start,i)=>{const end=points[i+1],active=matches.filter(x=>start>=x.start&&end<=x.start+x.r.quote.length).sort((a,b)=>b.r.date-a.r.date)[0];return active?`<mark class="${active.r.color}">${esc(text.slice(start,end))}</mark>`:esc(text.slice(start,end));}).join('');}
function demoCapsule(){return `<div class="demo-message-tools"><div class="demo-capsule"><div class="demo-capsule-actions" inert>${ib('收藏回复','demo-bookmark','bookmark')}${ib('复制回复','demo-copy','copy')}${ib('阅读器','demo-reader','bookOpen')}</div>${btn('','demo-capsule','icon-btn','chevronLeft','aria-label="展开消息工具" aria-expanded="false"')}</div><div class="demo-message-meta"><span>348 Chars</span><time>09-10 23:20</time></div></div>`;}
function demo(){return `<div class="demo-layout"><div class="page-head"><h1>页面高亮</h1><div class="segments">${btn('页面','demo-surface',state.demoSurface==='page'?'active':'','','data-value="page"')}${btn('Reader','demo-surface',state.demoSurface==='reader'?'active':'','','data-value="reader"')}</div></div><article class="demo-sheet"><div class="user-prompt">怎样整理阅读后的笔记？</div><h2>从一段文字开始</h2><p class="prose" data-message="message-design-01">${markedText('message-design-01')}</p>${demoCapsule()}<hr><p class="prose" data-message="message-design-02">${markedText('message-design-02')}</p>${demoCapsule()}<div class="demo-composer"><span>继续提问…</span><span>＋ ${icon('send')}</span></div></article><div class="demo-result"><span>${records.filter(r=>r.demo).length} 条高亮</span>${btn('查看高亮','demo-library','button','bookMarked')}</div></div>`;}
function drawer(){return `<div class="drawer" aria-label="页面工具抽屉">${state.drawer?`<div class="drawer-body">${ib('打开资料库','demo-library','bookMarked')}${ib('收藏示例会话','demo-bookmark','pageBookmark')}${ib('Reader','demo-reader','splitView')}${ib('Prompt 管理','demo-prompts','prompt')}</div>`:''}${btn('','drawer','drawer-trigger',state.drawer?'x':'layers',`aria-label="${state.drawer?'收起':'展开'}页面抽屉" aria-expanded="${state.drawer}"`)}</div>`;}
function openDialog(title,body,footer=''){document.querySelector('#modal-root').innerHTML=`<div class="dialog-layer"><section class="dialog" role="dialog" aria-modal="true" aria-label="${esc(title)}"><div class="dialog-header"><h2>${title}</h2>${ib('关闭弹窗','close-modal','x')}</div>${body}<div class="dialog-footer">${footer||btn('知道了','close-modal','button primary')}</div></section></div>`;document.querySelector('.dialog button')?.focus();}
function closeDialog(){document.querySelector('#modal-root').innerHTML='';}
function updateKeepingFocus(fn){const el=document.activeElement;const attr=el?.dataset.input;const start=el?.selectionStart;fn();render();if(attr){const next=document.querySelector(`[data-input="${attr}"]`);next?.focus();if(typeof start==='number')next?.setSelectionRange(start,start);}}
function actionSettings(key){if(key==='action.prompts'){openDialog('Prompt 管理',`<p>统一调用现有 Prompt 管理器。这里演示编辑体验，不写入扩展 Prompt 库。</p><label>名称</label><input id="prompt-name" value="逐条修改"><label>内容</label><textarea id="prompt-content">请根据我的注释逐条修改原文，保留未提及的内容。</textarea>`,btn('保存演示','save-prompt','button primary'));}
 else if(key==='reader.commentExport.template'){openDialog('注释输出模板',`<p>原文与注释保持现有占位符语义；正式实现复用当前模板编辑器。</p><label>模板预览</label><textarea id="template-editor">${esc(typeof values[key]==='string'?values[key]:'关于以下原文：\n{{selected_source}}\n\n我的注释：\n{{user_comment}}')}</textarea>`,btn('保存演示','save-template','button primary'));}
 else if(key==='action.localBackup')openDialog('本地备份范围','<p>现有导入 / 导出支持书签与文件夹。新格式将按类型加入注释和高亮，并在恢复前显示数量、重复项和冲突。</p><div class="notice">下面只导出本原型的演示资料，不是现有插件的可导入备份。</div>',btn('导出演示 JSON','export-demo','button primary'));
 else if(key==='action.drive')openDialog('Google Drive 备份','<p>正式接入时保留现有连接账户、备份、恢复预览、安全合并、替换本地和断开连接能力。当前原型不会连接账户。</p><div class="notice">现有云备份仅覆盖书签。完整资料备份需另行确定格式与恢复契约。</div>');
 else if(key==='action.storage')openDialog('本机数据范围',`<p>演示资料：书签 ${records.filter(x=>x.kind==='bookmark').length} 条，注释 ${records.filter(x=>x.kind==='annotation').length} 条，高亮 ${records.filter(x=>x.kind==='highlight').length} 条。</p><p>仅“页面高亮”中创建的 ${records.filter(x=>x.demo).length} 条演示记录写入这个 HTML 的独立存储。其他编辑只在当前页面内存有效。</p>`);
 else if(key==='action.diagnostics')openDialog('内容发现诊断','<p>原型未连接真实内容运行时，不能提供浏览器或 ChatGPT 诊断。</p><pre>surface: prototype\nsource: sample data\nreal runtime: disconnected</pre>');
 else if(key==='action.notice'){toast('演示：下次打开 Reader 时重新显示说明。');}
}
function downloadData(){const blob=new Blob([JSON.stringify({prototype:true,notExtensionBackup:true,records},null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='AI-MarkDone-PROTOTYPE-data.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
document.addEventListener('click',e=>{
 if(e.target.matches('[data-check]')){const id=e.target.dataset.check;e.target.checked?state.checked.add(id):state.checked.delete(id);render();return;}
 const node=e.target.closest('[data-action]');if(!node)return;const a=node.dataset.action;const id=node.dataset.id;if(['save-note','record-color','rename-save','delete-confirm','move-confirm','demo-clear','demo-bookmark'].includes(a)){recordRevision++;projectionCache=null;}const record=records.find(x=>x.id===id);const key=node.dataset.key;
 if(a==='nav'){state.view=node.dataset.view;state.selected=null;render();}
 if(a==='theme'){state.theme=state.theme==='light'?'dark':'light';values['proposal.theme']=state.theme;render();}

 if(a==='folder'){state.view='library';state.folder=node.dataset.value;state.filter='bookmark';state.page=1;state.search='';state.selected=null;state.multi=false;state.checked.clear();render();}
 if(a==='filter'){state.view='library';state.filter=node.dataset.value;state.folder='all';state.search='';state.page=1;state.selected=null;state.multi=false;state.checked.clear();render();}
 if(a==='layout'){state.layout=node.dataset.value;render();}
 if(a==='clear-filters'){state.folder='all';state.page=1;state.search='';render();}
 if(a==='record'){if(state.multi){state.checked.has(id)?state.checked.delete(id):state.checked.add(id);}else state.selected=id;render();}
 if(a==='close-detail'){state.selected=null;if(state.variant==='B')toast('详情随列表选择变化。');render();}
 if(a==='record-color'){record.color=node.dataset.color;persistDemo();render();}
 if(a==='save-note'&&record?.kind==='annotation'){const comment=document.querySelector('#detail-note').value.trim();record.comment=comment;persistDemo();render();toast('想法已更新（演示）');}
 if(a==='record-menu')openDialog('整理这条资料',`<p>${esc(record.title)}</p>`,`${record.kind==='bookmark'?btn('重命名','rename','button','edit',`data-id="${id}"`)+btn('移动','move-one','button','folder',`data-id="${id}"`):''}${btn('删除','delete-one','button danger','trash',`data-id="${id}"`)}`);
 if(a==='rename')openDialog('重命名资料',`<input id="rename-title" aria-label="资料标题" value="${esc(record.title)}">`,btn('保存','rename-save','button primary','',`data-id="${id}"`));
 if(a==='rename-save'){record.title=document.querySelector('#rename-title').value.trim()||record.title;closeDialog();render();}
 if(a==='delete-one'||a==='delete-selected'){const ids=a==='delete-one'?[id]:[...state.checked];if(!ids.length){toast('先选择需要删除的资料。');return;}openDialog('删除所选资料',`<p>将从演示资料中删除 ${ids.length} 条记录。删除不影响 ChatGPT 原文。</p>`,btn('取消','close-modal','button')+btn('删除','delete-confirm','button danger','',`data-ids="${ids.join(',')}"`));}
 if(a==='delete-confirm'){const ids=node.dataset.ids.split(',');records=records.filter(r=>!ids.includes(r.id));state.checked.clear();state.selected=null;persistDemo();closeDialog();render();toast('已删除演示资料');}
 if(a==='batch-toggle'){state.multi=!state.multi;state.checked.clear();render();}
 if(a==='select-visible'){pageRecords().forEach(x=>state.checked.add(x.id));render();}
 if(a==='move'||a==='move-one'){const ids=a==='move-one'?[id]:[...state.checked];if(!ids.length){toast('先选择需要移动的资料。');return;}openDialog('移动到文件夹',`<select id="move-folder" aria-label="目标文件夹">${folders.map(f=>`<option>${esc(f)}</option>`).join('')}</select>`,btn('移动','move-confirm','button primary','',`data-ids="${ids.join(',')}"`));}
 if(a==='move-confirm'){const ids=node.dataset.ids.split(',');const folder=document.querySelector('#move-folder').value;records.forEach(r=>{if(ids.includes(r.id))r.folder=folder;});persistDemo();closeDialog();render();toast('已移动演示资料');}
 if(a==='new-folder')openDialog('新建文件夹','<input id="folder-name" placeholder="文件夹名称" aria-label="文件夹名称">',btn('创建','folder-create','button primary'));
 if(a==='folder-create'){const name=document.querySelector('#folder-name').value.trim();if(!name)return;if(!folders.includes(name))folders.push(name);closeDialog();render();}
 if(a==='category'){state.view='settings';state.category=node.dataset.category;state.settingsSearch='';state.onlyModified=false;render();}
 if(a==='toggle-setting'){values[key]=!values[key];render();}
 if(a==='setting-action')actionSettings(key);
 if(a==='save-template'){values['reader.commentExport.template']=document.querySelector('#template-editor').value;closeDialog();toast('演示模板已保存');}
 if(a==='save-prompt'){closeDialog();toast('Prompt 演示已完成；正式版复用现有 Prompt 库。');}
 if(a==='drawer'){state.drawer=!state.drawer;render();}
 if(a==='demo-surface'){state.demoSurface=node.dataset.value;render();}
 if(a==='demo-clear'){records=records.filter(r=>!r.demo);persistDemo();render();toast('演示高亮已清除');}
 if(a==='demo-library'){state.view='library';state.filter='highlight';state.page=1;state.folder='all';state.sort='recent';state.search='';render();}
 if(a==='demo-reader'){state.demoSurface='reader';render();toast('已切到 Reader 演示，共用同一份高亮。');}
 if(a==='demo-prompts')actionSettings('action.prompts');
 if(a==='demo-bookmark'){if(!records.some(r=>r.id==='demo-bookmark'))records.unshift({...samples[0],id:'demo-bookmark',title:'页面高亮演示会话',date:Date.now(),time:'刚刚',subtype:'整个会话'});toast('演示会话已加入资料库（本次页面有效）');}
 if(a==='demo-nav'){const all=[...document.querySelectorAll('[data-message]')];all[node.dataset.dir==='prev'?0:1]?.scrollIntoView({behavior:'smooth',block:'center'});}
 if(a==='open-demo'){closeDialog();state.view='demo';render();}
 if(a==='more')openDialog('保留现有功能','<p>更新日志、FAQ、关于、Mappamory、赞助和反馈保留为辅助入口。本轮原型先聚焦资料库与设置，正式产品暂未移除这些面板。</p>');
 if(a==='transfer')openDialog('导入与导出','<p>正式书签的导入预览、去重、重命名、文件夹合并和异常修复能力继续保留。当前只演示独立数据文件。</p>',btn('查看导入预览','import-preview','button')+btn('导出演示 JSON','export-demo','button primary'));
 if(a==='import-preview')openDialog('导入预览 · 示例','<table class="inventory"><tr><td>新增书签</td><td>3 条</td></tr><tr><td>重复记录</td><td>2 条 · 跳过</td></tr><tr><td>标题冲突</td><td>1 条 · 保留两份</td></tr></table><p class="subtitle">真实实现复用既有导入检查；当前没有读取外部文件。</p>');
 if(a==='export-demo'){downloadData();toast('已导出演示 JSON；不能用于真实插件恢复。');}
 if(a==='icon-board'){location.href='./icons/index.html';}
 if(a==='page-prev'||a==='page-next'){state.page+=a==='page-next'?1:-1;render();}
 if(a==='library-menu'){openDialog(TYPES[state.filter][0]+'操作',`<label>排序</label><select data-change="sort" aria-label="资料排序">${[['recent','最新优先'],['old','最早优先'],['alpha','标题 A → Z'],['alpha-desc','标题 Z → A']].map(([v,l])=>`<option value="${v}" ${state.sort===v?'selected':''}>${l}</option>`).join('')}</select>`,btn('批量管理','manage-from-menu','button')+(state.filter==='bookmark'?btn('新建文件夹','new-folder','button')+btn('导入 / 导出','transfer','button'):'')+btn('完成','close-modal','button primary'));}
 if(a==='manage-from-menu'){closeDialog();state.multi=true;state.checked.clear();render();}
 if(a==='close-modal')closeDialog();
});
document.addEventListener('input',e=>{if(e.target.dataset.input==='library-search')updateKeepingFocus(()=>{state.search=e.target.value;state.page=1;});if(e.target.dataset.input==='settings-search')updateKeepingFocus(()=>state.settingsSearch=e.target.value);if(e.target.type==='range'&&e.target.dataset.setting){values[e.target.dataset.setting]=Number(e.target.value);const r=settingsRows.find(x=>x.key===e.target.dataset.setting);e.target.nextElementSibling.textContent=e.target.value+r.unit;}});
document.addEventListener('change',e=>{if(e.target.dataset.change==='sort'){state.sort=e.target.value;state.page=1;render();}if(e.target.dataset.change==='folder'){state.folder=e.target.value;state.page=1;render();}if(e.target.dataset.setting){const key=e.target.dataset.setting;values[key]=e.target.type==='range'?Number(e.target.value):e.target.value;if(key==='proposal.theme'){state.theme=e.target.value==='auto'?(matchMedia('(prefers-color-scheme:dark)').matches?'dark':'light'):e.target.value;}render();}});
document.addEventListener('keydown',e=>{const editable=e.target.matches('input,textarea,select,[contenteditable]');if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='k'){e.preventDefault();document.querySelector('.searchbox input')?.focus();return;}if(e.key==='Escape'){if(document.querySelector('.dialog-layer')){closeDialog();return;}state.selected=null;render();return;}if(e.key==='Tab'&&document.querySelector('.dialog')){const els=[...document.querySelectorAll('.dialog button,.dialog input,.dialog select,.dialog textarea')].filter(x=>!x.disabled);if(e.shiftKey&&document.activeElement===els[0]){e.preventDefault();els.at(-1)?.focus();}if(!e.shiftKey&&document.activeElement===els.at(-1)){e.preventDefault();els[0]?.focus();}return;}if(!editable&&(e.key==='Enter'||e.key===' ')&&e.target.matches('.compact-row')){e.preventDefault();e.target.click();}});
let demoSelection=null;
function clearDemoSelection(){document.querySelector('.demo-selection-tools')?.remove();demoSelection=null;}
document.addEventListener('pointerdown',e=>{if(e.target.closest('.demo-selection-tools'))e.preventDefault();else clearDemoSelection();});
document.addEventListener('pointerup',e=>{if(state.view!=='demo'||e.target.closest('button'))return;const sel=getSelection();if(!sel||sel.isCollapsed||!sel.rangeCount)return;const range=sel.getRangeAt(0),element=range.startContainer.parentElement?.closest('[data-message]');if(!element||!element.contains(range.endContainer))return;const before=document.createRange();before.selectNodeContents(element);before.setEnd(range.startContainer,range.startOffset);const quote=sel.toString();if(!quote.trim())return;demoSelection={quote,start:before.toString().length,messageId:element.dataset.message,full:element.textContent};const box=range.getBoundingClientRect(),tools=document.createElement('div');tools.className='demo-selection-tools';tools.style.left=Math.max(10,Math.min(box.left,innerWidth-230))+'px';tools.style.top=Math.max(10,Math.min(box.bottom+8,innerHeight-60))+'px';tools.innerHTML=ib('复制','selection-copy','copy')+ib('注释','selection-note','messageSquareText')+swatches(null,'selection-highlight');document.body.append(tools);});
document.addEventListener('click',async e=>{const button=e.target.closest('[data-action]');if(!button)return;const action=button.dataset.action;if(action==='demo-capsule'){const capsule=button.closest('.demo-capsule'),open=capsule.classList.toggle('open');button.setAttribute('aria-expanded',String(open));capsule.querySelector('.demo-capsule-actions').toggleAttribute('inert',!open);}if(action==='demo-copy'){await navigator.clipboard.writeText(button.closest('.demo-sheet').querySelector('.prose').textContent);toast('已复制');}if(!demoSelection)return;const snapshot=demoSelection;if(action==='selection-copy'){await navigator.clipboard.writeText(snapshot.quote);clearDemoSelection();toast('已复制');}if(action==='selection-note'){openDialog('添加注释',`<blockquote>${esc(snapshot.quote)}</blockquote><textarea id="selection-note-text" aria-label="注释内容"></textarea>`,btn('保存','selection-note-save','button primary'));}if(action==='selection-note-save'){const comment=document.querySelector('#selection-note-text').value.trim();if(!comment)return;records.unshift({id:crypto.randomUUID(),kind:'annotation',title:snapshot.quote,quote:snapshot.quote,comment,conversation:'页面高亮演示会话',date:Date.now(),time:'刚刚',sourceUrl:location.href});recordRevision++;projectionCache=null;closeDialog();clearDemoSelection();toast('已保存');}if(action==='selection-highlight'){const color=button.dataset.color,existing=records.find(r=>r.demo&&r.messageId===snapshot.messageId&&r.start===snapshot.start&&r.quote===snapshot.quote);if(existing){existing.color=color;existing.date=Date.now();}else records.unshift({id:crypto.randomUUID(),demo:true,kind:'highlight',...snapshot,title:snapshot.quote,color,prefix:snapshot.full.slice(Math.max(0,snapshot.start-28),snapshot.start),suffix:snapshot.full.slice(snapshot.start+snapshot.quote.length,snapshot.start+snapshot.quote.length+28),conversation:'页面高亮演示会话',date:Date.now(),time:'刚刚',sourceUrl:location.href.split('?')[0]+'?view=demo'});persistDemo();clearDemoSelection();getSelection()?.removeAllRanges();render();}});
render();
