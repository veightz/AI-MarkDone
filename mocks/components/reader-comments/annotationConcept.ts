import { getTokenCss } from '../../../src/style/tokens';
import { ensureStyle } from '../../../src/style/shadow';

export function mountAnnotationConcept(): void {
    const stage = document.querySelector<HTMLElement>('#reader-comments-stage');
    if (!stage) return;
    const host = document.createElement('div');
    stage.append(host);
    const shadow = host.attachShadow({ mode: 'open' });
    ensureStyle(shadow, getTokenCss());
    ensureStyle(shadow, `
      :host { display:block; color:var(--aimd-text-primary); font-family:var(--aimd-font-family-sans); }
      * { box-sizing:border-box; }
      .stage { position:relative; min-height:650px; padding:var(--aimd-space-6); background:var(--aimd-bg-primary); border-radius:var(--aimd-radius-xl); }
      .source { max-width:44em; line-height:1.8; }
      .window { position:absolute; top:var(--aimd-space-6); right:var(--aimd-space-6); width:min(420px, calc(100% - var(--aimd-space-6) * 2)); display:grid; gap:var(--aimd-space-4); padding:var(--aimd-space-4); background:var(--aimd-workspace-card); border:1px solid var(--aimd-workspace-border); border-radius:var(--aimd-radius-2xl); box-shadow:var(--aimd-shadow-workspace); }
      .head,.foot,.tools { display:flex; align-items:center; gap:var(--aimd-space-2); }
      .head { justify-content:space-between; cursor:grab; }
      h3 { margin:0; font-size:var(--aimd-text-sm); font-weight:var(--aimd-font-semibold); }
      button,textarea { font:inherit; color:inherit; }
      button { cursor:pointer; border:1px solid transparent; background:transparent; border-radius:var(--aimd-radius-lg); padding:var(--aimd-space-2); }
      .tools button { width:var(--aimd-size-control-icon-panel); height:var(--aimd-size-control-icon-panel); padding:0; }
      button:hover { background:var(--aimd-bg-secondary); }
      .quote { margin:0; padding:var(--aimd-space-3); background:var(--aimd-workspace-surface); border-radius:var(--aimd-radius-lg); border-left:var(--aimd-space-1) solid var(--aimd-border-default); font-size:var(--aimd-text-sm); line-height:1.6; }
      .label,.status { margin:0; color:var(--aimd-text-secondary); font-size:var(--aimd-text-xs); }
      .label { margin-bottom:var(--aimd-space-2); }
      textarea { width:100%; min-height:190px; padding:var(--aimd-space-3); resize:vertical; border:1px solid var(--aimd-workspace-border); border-radius:var(--aimd-radius-lg); background:var(--aimd-workspace-surface); font-size:var(--aimd-text-sm); line-height:1.6; }
      textarea:focus-visible,button:focus-visible { outline:2px solid var(--aimd-interactive-primary); outline-offset:var(--aimd-space-1); }
      .foot { justify-content:space-between; flex-wrap:wrap; }
      .save { background:var(--aimd-interactive-primary); color:var(--aimd-text-on-primary); padding-inline:var(--aimd-space-4); }
      .status { flex:1; }
      .window[data-minimized] .body,.window[data-minimized] .foot { display:none; }
      .window[data-expanded] { inset:var(--aimd-space-4); width:auto; }
      .window[data-expanded] textarea { min-height:340px; }
    `);
    shadow.innerHTML += `<div class="stage"><article class="source"><h2>为阅读过程保留思考</h2><p>阅读器与页面使用同一份内容，注释窗口应让你继续阅读原文、选中文字，并保留尚未整理完的想法。</p><p>你可以拖动右侧注释窗口避开正在阅读的段落。点击窗口外继续阅读，输入保持原样；收起之后，展开继续写。</p></article><section class="window"><header class="head"><h3>添加注释</h3><div class="tools"><button data-action="minimize" aria-label="收起">−</button><button data-action="expand" aria-label="放大">⤢</button><button data-action="close" aria-label="关闭并保留草稿">×</button></div></header><div class="body"><p class="label">选中内容</p><blockquote class="quote">“注释窗口应让你继续阅读原文，并保留尚未整理完的想法。”</blockquote><p class="label" style="margin-top:var(--aimd-space-4)">你的注释</p><textarea>这部分可以像一个随手记的小窗口，让我一边看原文一边整理想法。</textarea></div><footer class="foot"><p class="status">草稿已保存在本机</p><button>放弃草稿</button><button class="save">保存注释</button></footer></section></div>`;
    const win = shadow.querySelector<HTMLElement>('.window')!;
    shadow.querySelector('[data-action="minimize"]')!.addEventListener('click', () => win.toggleAttribute('data-minimized'));
    shadow.querySelector('[data-action="expand"]')!.addEventListener('click', () => { win.removeAttribute('data-minimized'); win.toggleAttribute('data-expanded'); });
    shadow.querySelector('[data-action="close"]')!.addEventListener('click', () => win.toggleAttribute('data-minimized'));
    const head = shadow.querySelector<HTMLElement>('.head')!;
    head.addEventListener('pointerdown', event => {
        if ((event.target as Element).closest('button')) return;
        const rect = win.getBoundingClientRect(); const outer = head.parentElement!.parentElement!.getBoundingClientRect();
        const x = event.clientX; const y = event.clientY; head.setPointerCapture(event.pointerId);
        const move = (next: PointerEvent) => { win.style.right='auto'; win.style.left=`${Math.max(0, rect.left-outer.left+next.clientX-x)}px`; win.style.top=`${Math.max(0, rect.top-outer.top+next.clientY-y)}px`; };
        const stop = () => { head.removeEventListener('pointermove', move); head.removeEventListener('pointerup', stop); };
        head.addEventListener('pointermove', move); head.addEventListener('pointerup', stop);
    });
}
