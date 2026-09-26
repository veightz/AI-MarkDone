// Review-only vector family. Shapes share a 24-unit canvas and rounded 1.75-unit strokes.
// Conventional pictograms were studied in Lucide and Material; paths below are authored for this prototype.
const path=d=>`<path d="${d}"/>`;
const rect=(x,y,w,h,r=2.5)=>`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}"/>`;
const circle=(x,y,r)=>`<circle cx="${x}" cy="${y}" r="${r}"/>`;
const dot=(x,y,r=1)=>`<circle cx="${x}" cy="${y}" r="${r}" fill="currentColor" stroke="none"/>`;
const shape={
 bookMarked:rect(3.5,4.5,4,15,1.5)+rect(9.5,4.5,4,15,1.5)+path('m17 5 3.5-.8 3.1 14.1-3.6.8Z M4 16.5h3 M10 16.5h3'),
 layers:path('m4 7 8-3.5L20 7l-8 3.5L4 7Z M4 12l8 3.5 8-3.5 M4 17l8 3.5 8-3.5'),
 bookmark:path('M6.5 20V5.5A2 2 0 0 1 8.5 3.5h7a2 2 0 0 1 2 2V20L12 16.5 6.5 20Z'),
 bookmarkCheck:path('M6.5 20V5.5a2 2 0 0 1 2-2h7a2 2 0 0 1 2 2V20L12 16.5 6.5 20Z m2.8-10 1.9 1.9 3.9-4'),
 pageBookmark:path('M14 3.5H6.5a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2H11 M14 3.5 19.5 9H16a2 2 0 0 1-2-2V3.5Z M14 13h6v8l-3-2-3 2v-8Z'),
 folder:path('M3.5 8V6a2 2 0 0 1 2-2h3.2l2.5 3h7.3a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2V8Z M3.5 9h17'),
 folderOpen:path('M3.5 10V6a2 2 0 0 1 2-2h3.2l2.5 3h7.3a2 2 0 0 1 2 2 M5 20h13a2 2 0 0 0 2-1.6l1.3-6.4H6l-2.4 6.4A1.2 1.2 0 0 0 5 20Z'),
 folderPlus:path('M3.5 8V6a2 2 0 0 1 2-2h3.2l2.5 3h7.3a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2V8Z M9 14h6 M12 11v6'),
 bookOpen:path('M12 6C9.5 4 6.3 3.8 3.5 4.5V19C7 18.2 9.5 18.5 12 20c2.5-1.5 5-1.8 8.5-1V4.5C17.7 3.8 14.5 4 12 6Z M12 6v14 M6.5 8.5l2.5.5 M15 9l2.5-.5'),
 fileText:path('M13.5 3.5h-7a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2V9.5l-6-6Z M13.5 3.5v4a2 2 0 0 0 2 2h4 M8 13h8 M8 16.5h5'),
 outline:path('M8 5h12 M8 12h12 M8 19h8')+dot(4,5)+dot(4,12)+dot(4,19),
 panelLeft:rect(3.5,4.5,17,15,3)+path('M9 4.5v15 M6 8v3'),
 splitView:rect(3.5,4.5,17,15,3)+path('M12 4.5v15 M6.5 8h2 M15.5 8h2'),
 maximize:path('M4.5 9V4.5H9 M15 4.5h4.5V9 M19.5 15v4.5H15 M9 19.5H4.5V15'),
 minimize:path('M4.5 9H9V4.5 M15 4.5V9h4.5 M19.5 15H15v4.5 M9 19.5V15H4.5'),
 brush:path('m10.2 9.6 5.5-6a2 2 0 0 1 2.8 0l1.9 1.9a2 2 0 0 1 0 2.8l-6 5.5 M10.2 9.6l4.2 4.2 M8.8 11c-2.2-.1-3.8 1.5-3.8 3.8 0 1.8-1 2.4-2 3 2.5 1.1 6.4 1.1 8.1-.6 1.5-1.5 1.5-3.2.6-4.4L8.8 11Z')+'<rect x="3" y="21" width="9" height="1.5" rx=".75" fill="currentColor" stroke="none"/>',
 highlighter:path('m9 12 7-8a1.8 1.8 0 0 1 2.6-.1l1.5 1.5A1.8 1.8 0 0 1 20 8l-8 7 M9 12l3 3-3 3H5v-4l4-2Z M3 21h10'),
 edit:path('m5 14 10.3-10.3a2 2 0 0 1 2.8 0l2.2 2.2a2 2 0 0 1 0 2.8L10 19l-6 1 1-6Z M13.8 5.2l5 5 M5 14l5 5'),
 messageSquareText:path('M8 19.5 4 22V6a2.5 2.5 0 0 1 2.5-2.5h11A2.5 2.5 0 0 1 20 6v11a2.5 2.5 0 0 1-2.5 2.5H8Z M8 9h8 M8 13h5'),
 messageSquarePlus:path('M8 19.5 4 22V6a2.5 2.5 0 0 1 2.5-2.5h11A2.5 2.5 0 0 1 20 6v11a2.5 2.5 0 0 1-2.5 2.5H8Z M8.5 11.5h7 M12 8v7'),
 messageSquareShare:path('M11 3.5H6.5A2.5 2.5 0 0 0 4 6v16l4-2.5h9.5A2.5 2.5 0 0 0 20 17v-3 M10 12l10-8 M14 4h6v6'),
 prompt:path('M8 19.5 4 22V6a2.5 2.5 0 0 1 2.5-2.5h11A2.5 2.5 0 0 1 20 6v11a2.5 2.5 0 0 1-2.5 2.5H8Z M8 8l3 3-3 3 M13 14h3'),
 pin:path('M8 4h8 M9 4v5l-3 5v2h12v-2l-3-5V4 M12 16v5'),
 locate:circle(12,12,6.5)+circle(12,12,2)+path('M12 2.5v3 M12 18.5v3 M2.5 12h3 M18.5 12h3'),
 search:circle(10.5,10.5,6.5)+path('m15.3 15.3 5.2 5.2'),
 settings:path('M6 3.5v5 M6 14v6.5 M18 3.5V10 M18 15v5.5')+circle(6,11.5,2.5)+circle(18,12.5,2.5),
 grid:rect(3.5,3.5,6.5,6.5,2)+rect(14,3.5,6.5,6.5,2)+rect(3.5,14,6.5,6.5,2)+rect(14,14,6.5,6.5,2),
 filter:path('M4 5h16 M7 12h10 M10 19h4')+circle(8,5,1.7)+circle(15,12,1.7),
 menu:path('M4 5h16 M4 12h16 M4 19h16'),
 keyboard:rect(2.5,5,19,14,3)+path('M7 15h10')+[6,10,14,18].map(x=>dot(x,9,.65)+dot(x,12,.65)).join(''),
 textCursor:path('M4 5h9 M8.5 5v14 M6 19h5 M17 3.5h4 M19 3.5v17 M17 20.5h4'),
 sun:circle(12,12,4)+path('M12 2.5v2 M12 19.5v2 M2.5 12h2 M19.5 12h2 M5.3 5.3l1.4 1.4 M17.3 17.3l1.4 1.4 M5.3 18.7l1.4-1.4 M17.3 6.7l1.4-1.4'),
 moon:path('M19.8 15.2A8.5 8.5 0 0 1 8.8 4.2 8.5 8.5 0 1 0 19.8 15.2Z'),
 eye:path('M2.5 12C5 7.5 8 5.5 12 5.5S19 7.5 21.5 12c-2.5 4.5-5.5 6.5-9.5 6.5S5 16.5 2.5 12Z')+circle(12,12,2.8),
 copy:rect(8,8,12.5,12.5,2.8)+path('M15.5 4H6A2 2 0 0 0 4 6v9.5'),
 download:path('M12 3.5v12 M7.5 11l4.5 4.5 4.5-4.5 M4 16v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3'),
 upload:path('M12 15.5v-12 M7.5 8 12 3.5 16.5 8 M4 16v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3'),
 share:path('M12 15V3 M8 7l4-4 4 4 M7 9H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8a2 2 0 0 0-2-2h-1'),
 link:path('m9 15 6-6 M8 8l-3 3a4 4 0 0 0 0 5.7l2.3 2.3a4 4 0 0 0 5.7 0l3-3 M16 16l3-3a4 4 0 0 0 0-5.7L16.7 5A4 4 0 0 0 11 5L8 8'),
 externalLink:path('M10 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4 M14 3.5h6.5V10 M10 14 20.5 3.5'),
 database:'<ellipse cx="12" cy="5.5" rx="8" ry="3"/>'+path('M4 5.5v13c0 1.7 3.6 3 8 3s8-1.3 8-3v-13 M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3'),
 cloud:path('M6.5 19.5a4.5 4.5 0 0 1-.4-9A6 6 0 0 1 17.8 9a5.3 5.3 0 0 1 .7 10.5 M12 13v8 M9 18l3 3 3-3'),
 image:rect(3.5,3.5,17,17,3)+circle(8.5,8.5,1.5)+path('m4 17 4.5-4.5 3 3 3.5-5 5.5 7'),
 fileBox:path('M13.5 3.5h-7a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2V9.5l-6-6Z M13.5 3.5v4a2 2 0 0 0 2 2h4 M10 4v3 M10 10v3 M10 16v2'),
 code:rect(2.5,4.5,19,15,3)+path('m9 9-3 3 3 3 M15 9l3 3-3 3'),
 sigma:path('M19 5V3.5H5l7 8.5-7 8.5h14V19'),
 wrapText:path('M4 5h16 M4 10h12a4 4 0 0 1 0 8h-5 M14 15l-3 3 3 3 M4 15h3'),
 bold:path('M7 3.5h6a4 4 0 0 1 0 8H7v-8Z M7 11.5h7a4.5 4.5 0 0 1 0 9H7v-9Z'),
 listOrdered:path('M9 5h11 M9 12h11 M9 19h11 M3 4l1-1v5 M2.5 11.5a1.5 1.5 0 0 1 3 0c0 1-3 2-3 3h3 M3 18h2l-1 1.5a1.5 1.5 0 0 1 1.5 1.2c0 1-1.5 1.4-2.8.7'),
 plus:path('M12 4v16 M4 12h16'),minus:path('M4 12h16'),x:path('m5 5 14 14 M19 5 5 19'),
 check:path('m4.5 12.5 5 5L20 6.5'),
 checkSquare:rect(3.5,3.5,17,17,4)+path('m7.5 12 3 3 6-6'),
 checkCircle:circle(12,12,9)+path('m7.5 12 3 3 6-6'),
 xCircle:circle(12,12,9)+path('m9 9 6 6 M15 9l-6 6'),
 alertTriangle:path('M10.2 4.2 2.7 17.5A2 2 0 0 0 4.5 20.5h15a2 2 0 0 0 1.8-3L13.8 4.2a2 2 0 0 0-3.6 0Z M12 9v4.5')+dot(12,17,.8),
 info:circle(12,12,9)+path('M12 10.5V17')+dot(12,7,.85),
 hourglass:path('M5 3.5h14 M5 20.5h14 M6.5 3.5V7l5.5 5 5.5-5V3.5 M6.5 20.5V17l5.5-5 5.5 5v3.5'),
 refreshCw:path('M20 9a8.5 8.5 0 0 0-14-4L3.5 7.5 M3.5 3v4.5H8 M4 15a8.5 8.5 0 0 0 14 4l2.5-2.5 M16 16.5h4.5V21'),
 trash:path('M3.5 6h17 M9 6V3.5h6V6 M5.5 6l.8 13a2 2 0 0 0 2 2h7.4a2 2 0 0 0 2-2l.8-13 M10 10v7 M14 10v7'),
 wrench:path('M14 3.5a6 6 0 0 0-6.8 7.8L3.7 16a2.8 2.8 0 0 0 4 4l4.7-3.5a6 6 0 0 0 7.8-6.8l-3.7 3-4-4 3-3.7'),
 move:path('M12 3v18 M3 12h18 M9 6l3-3 3 3 M18 9l3 3-3 3 M9 18l3 3 3-3 M6 9l-3 3 3 3'),
 send:path('m3 11 18-8-8 18-3-8-7-2Z M10 13 21 3'),
 chevronDown:path('m5 9 7 7 7-7'),chevronUp:path('m5 15 7-7 7 7'),chevronRight:path('m9 5 7 7-7 7'),chevronLeft:path('m15 5-7 7 7 7'),
 moreHorizontal:dot(5,12,1.2)+dot(12,12,1.2)+dot(19,12,1.2),
 gripHorizontal:[5,12,19].map(x=>dot(x,8,1)+dot(x,16,1)).join(''),
 globe:circle(12,12,9)+path('M3 12h18 M12 3c-5 5-5 13 0 18 5-5 5-13 0-18Z'),
 languages:path('M3 6h11 M8.5 3.5V6 M5 9c1.5 3.5 4 6 7.5 7.5 M12 6c-1 5-4.5 9-9 11 M13 21l4-10 4 10 M14.5 17h5'),
};
const sortBase=up=>path(up?'M6 20V4 M3 7l3-3 3 3':'M6 4v16 M3 17l3 3 3-3');
shape.sortTime=sortBase(false)+circle(16,8,4)+path('M16 6v2l1.5 1 M13 17h7 M13 20h4');
shape.sortTimeAsc=sortBase(true)+circle(16,8,4)+path('M16 6v2l1.5 1 M13 17h7 M13 20h4');
const az=path('m13 9 3-6 3 6 M14 7h4 M13 14h6l-6 6h6');
shape.sortAZ=sortBase(false)+az;shape.sortAlphaAsc=sortBase(true)+az;
// Optical correction: keep the library family inside the same 3–21 live area.
shape.bookMarked=rect(3,5,4,15,1.4)+rect(9,5,4,15,1.4)+path('m16 5 3.4-.7 2.8 14.7-3.4.7Z M3.5 16.5h3 M9.5 16.5h3');
export const paths=shape;
export const Glyphs=Object.fromEntries(Object.entries(shape).map(([name,body])=>[name,`<svg class="aimd-glyph" data-glyph="${name}" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`]));
export const iconGroups=[
 ['资料与归档',[['bookMarked','资料库'],['layers','全部资料'],['bookmark','消息书签'],['bookmarkCheck','已收藏'],['pageBookmark','会话收藏'],['folder','文件夹'],['folderOpen','展开文件夹'],['folderPlus','新建文件夹']]],
 ['阅读与标记',[['bookOpen','阅读器'],['outline','大纲'],['brush','高亮画笔'],['highlighter','荧光笔备选'],['edit','编辑'],['messageSquareText','注释'],['messageSquarePlus','添加注释'],['messageSquareShare','插入注释'],['prompt','Prompt'],['pin','固定'],['locate','回到原文'],['search','搜索']]],
 ['布局与输入',[['settings','设置'],['grid','卡片'],['menu','列表'],['panelLeft','侧栏'],['splitView','独立阅读'],['maximize','展开'],['minimize','收起'],['textCursor','输入增强'],['keyboard','快捷键'],['bold','加粗'],['listOrdered','有序列表'],['wrapText','换行'],['sun','浅色'],['moon','深色'],['eye','预览'],['filter','筛选']]],
 ['输出与管理',[['copy','复制'],['download','导出'],['upload','导入'],['share','分享'],['link','链接'],['externalLink','外部打开'],['fileText','文档'],['fileBox','压缩文件'],['image','图片'],['code','代码'],['sigma','公式'],['database','本机数据'],['cloud','云备份'],['trash','删除'],['refreshCw','刷新'],['wrench','诊断'],['move','移动'],['send','发送']]],
 ['状态与辅助',[['plus','添加'],['minus','减少'],['check','完成'],['checkSquare','批量选择'],['checkCircle','成功'],['x','关闭'],['xCircle','失败'],['alertTriangle','需注意'],['info','说明'],['hourglass','处理中'],['chevronUp','上一条'],['chevronDown','下一条'],['chevronLeft','向左'],['chevronRight','向右'],['moreHorizontal','更多'],['gripHorizontal','拖动'],['languages','语言'],['globe','网站']]],
 ['排序',[['sortAZ','标题降序'],['sortAlphaAsc','标题升序'],['sortTime','时间降序'],['sortTimeAsc','时间升序']]],
];
