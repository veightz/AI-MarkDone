import {writeFileSync} from 'node:fs';
import {settingsRows,groups,defaults,excludedFields} from './settings-data.js';
const walk=(v,p='')=>Object.entries(v).flatMap(([k,x])=>x&&typeof x==='object'&&!Array.isArray(x)?walk(x,p+k+'.'):[p+k]);
const leaves=walk(defaults);const known=new Set([...settingsRows.map(r=>r.key),...Object.keys(excludedFields)]);
const missing=leaves.filter(k=>!known.has(k));if(missing.length)throw Error('Unmapped: '+missing.join(', '));
const get=path=>path.split('.').reduce((o,k)=>o?.[k],defaults);
const fmt=v=>JSON.stringify(v)?.replaceAll('|','\\|')??'—';
let md='# 设置字段全量盘点\n\n2026-09-12。根据当前 DEFAULT_SETTINGS 读取默认值；UI 按分类与搜索组织，已移除未讨论的固定、已修改筛选、密度及额外持久化开关。\n\n';
md+=`共 ${leaves.length} 个 schema 叶节点：${leaves.length-Object.keys(excludedFields).length} 个映射到设置中心，${Object.keys(excludedFields).length} 个为内部、兼容或遗留字段。\n\n`;
for(const [id,label]of groups){const rows=settingsRows.filter(r=>r.group===id);if(!rows.length)continue;md+=`## ${label}\n\n| 项目 | 职能 | 字段 | 默认值 / 状态 |\n|---|---|---|---|\n`;for(const r of rows)md+=`| ${r.label} | ${r.desc} | \`${r.key}\` | ${r.proposal?'本轮新设计':r.key.startsWith('action.')?'现有管理动作':r.key.endsWith('.template')?'结构化模板':fmt(get(r.key))} |\n`;md+='\n';}
md+='## 内部与遗留字段\n\n| 字段 | 去向 |\n|---|---|\n';for(const[k,v]of Object.entries(excludedFields))md+=`| \`${k}\` | ${v} |\n`;
md+='\n## 额外核对\n\n- Prompt library 为独立持久化与管理器，不重新编辑旧 prompts 字段。\n- Reader 窗口比例、阅读位置、Sticky、发送草稿属于现有 runtime/session 状态，不额外增加设置条目。\n- 原有主题跟随页面；独立浅/深色为本轮已要求设计的能力。\n- 书签当前文件夹/搜索/预览/选择属于视图状态。\n- 现有本地与 Google Drive 备份只包含书签，完整资料备份不纳入本轮。\n- 目录代码默认关闭，与旧文档部分默认开启描述存在漂移，尚未修改实际默认值。\n';
writeFileSync(new URL('./SETTINGS-INVENTORY.md',import.meta.url),md);console.log({leaves:leaves.length,mapped:leaves.length-Object.keys(excludedFields).length,unmapped:missing.length});
