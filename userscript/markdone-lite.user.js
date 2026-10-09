// ==UserScript==
// @name         MarkDone Lite
// @namespace    https://github.com/veightz/AI-MarkDone
// @updateURL    https://raw.githubusercontent.com/veightz/AI-MarkDone/main/userscript/markdone-lite.user.js
// @downloadURL  https://raw.githubusercontent.com/veightz/AI-MarkDone/main/userscript/markdone-lite.user.js
// @version      0.1.202610100130
// @description  ChatGPT 日用子集：视口跟随阅读器、大纲钉住、页面宽度、软刷新消息导航（非全功能扩展）
// @author       veightz
// @match        *://chatgpt.com/*
// @match        *://chat.openai.com/*
// @grant        GM_getValue
// @grant        GM_setValue
// @run-at       document-idle
// @inject-into  content
// ==/UserScript==

/**
 * MarkDone Userscript Lite — thin page-DOM wrappers.
 * Does NOT load dist-chrome/content.js or chrome.* APIs.
 * Full extension remains the capability ceiling; this is daily reading UX only.
 */
(function () {
  'use strict';

  if (window.top != null && window.self !== window.top) return;
  if (window.__mdliteBooted) return;
  window.__mdliteBooted = true;

  var VERSION = '0.1.202610100130';
  var NS = 'mdlite';
  var PIN_KEY = 'mdliteReaderOutlinePinned';
  var NARROW_PX = 720;
  var HYSTERESIS_MS = 160;
  var REF_RATIO = 0.35;

  // ---- storage (GM → localStorage fallback) ----
  function storeGet(key, def) {
    try {
      if (typeof GM_getValue === 'function') return GM_getValue(key, def);
    } catch (_) { /* ignore */ }
    try {
      var raw = localStorage.getItem(key);
      if (raw == null) return def;
      return JSON.parse(raw);
    } catch (_) {
      return def;
    }
  }
  function storeSet(key, val) {
    try {
      if (typeof GM_setValue === 'function') {
        GM_setValue(key, val);
        return true;
      }
    } catch (_) { /* ignore */ }
    try {
      localStorage.setItem(key, JSON.stringify(val));
      return true;
    } catch (_) {
      return false;
    }
  }

  // ---- toast ----
  function toast(text, opts) {
    opts = opts || {};
    var el = document.createElement('div');
    el.className = NS + '-toast';
    el.setAttribute('role', 'status');
    var span = document.createElement('span');
    span.textContent = text;
    el.appendChild(span);
    if (opts.actionLabel && typeof opts.onAction === 'function') {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = opts.actionLabel;
      btn.addEventListener('click', function () {
        opts.onAction();
        el.remove();
      });
      el.appendChild(btn);
    }
    document.documentElement.appendChild(el);
    setTimeout(function () {
      el.remove();
    }, opts.durationMs || 5000);
  }

  // ---- DOM discovery (Lite; not full PageIndex) ----
  // Mirrors extension ChatGPTAdapter.getMessageSelector(): two observed DOM shapes.
  var ASSISTANT_SELECTOR = [
    '[data-message-author-role="assistant"]',
    '[data-chatgpt-search-unit-key$=":assistant"]',
  ].join(',');
  var CONTENT_SELECTOR =
    '.markdown.prose, [data-markdown-text-style="assistant-message"], .markdown, .prose, [class*="markdown"]';

  function assistantRoots() {
    var nodes = document.querySelectorAll(ASSISTANT_SELECTOR);
    var out = [];
    for (var i = 0; i < nodes.length; i++) {
      var n = nodes[i];
      if (!(n instanceof HTMLElement)) continue;
      if (!n.isConnected) continue;
      if (n.closest('[class^="' + NS + '-"],[class*=" ' + NS + '-"]')) continue; // our own clones
      // Prefer outermost match (search-unit wraps role nodes on newer DOM).
      var outer = n.parentElement && n.parentElement.closest(ASSISTANT_SELECTOR);
      if (outer) continue;
      out.push(n);
    }
    return out;
  }

  function collectRounds() {
    var roots = assistantRoots();
    var stopVisible = !!document.querySelector('button[data-testid="stop-button"]');
    var rounds = [];
    for (var i = 0; i < roots.length; i++) {
      var root = roots[i];
      if (root.querySelector('.result-streaming, [data-is-streaming="true"]')) continue;
      if (stopVisible && i === roots.length - 1) continue;
      var rect = root.getBoundingClientRect();
      if (!Number.isFinite(rect.top) || (rect.height <= 0 && rect.width <= 0)) continue;
      rounds.push({
        index: i,
        root: root,
        top: rect.top,
        bottom: rect.bottom,
        left: rect.left,
        right: rect.right,
        id:
          root.getAttribute('data-message-id') ||
          root.getAttribute('data-chatgpt-search-unit-key') ||
          root.id ||
          String(i),
      });
    }
    return rounds;
  }

  function resolvePrimary(rounds) {
    var vh = window.innerHeight || 1;
    var lineY = Math.round(vh * REF_RATIO);
    var best = null;
    var bestOverlap = 0;
    var nearest = null;
    var nearestDist = Infinity;
    for (var i = 0; i < rounds.length; i++) {
      var r = rounds[i];
      if (r.bottom <= 0 || r.top >= vh) continue;
      var band = Math.max(12, Math.round(vh * 0.02));
      var overlap = Math.min(r.bottom, lineY + band) - Math.max(r.top, lineY - band);
      if (overlap > bestOverlap) {
        bestOverlap = overlap;
        best = r;
      }
      var dist = lineY < r.top ? r.top - lineY : lineY > r.bottom ? lineY - r.bottom : 0;
      if (dist < nearestDist) {
        nearestDist = dist;
        nearest = r;
      }
    }
    return best || nearest;
  }

  // ---- outline from message HTML ----
  function buildOutline(root) {
    var items = [];
    if (!root) return items;
    var content = root.querySelector(CONTENT_SELECTOR) || root;
    var nodes = content.querySelectorAll('h1,h2,h3,h4,p,li');
    var seen = Object.create(null);
    for (var i = 0; i < nodes.length; i++) {
      var node = nodes[i];
      var text = (node.textContent || '').trim().replace(/\s+/g, ' ');
      if (!text || text.length > 120) continue;
      var level = 2;
      var tag = node.tagName.toLowerCase();
      if (tag === 'h1') level = 1;
      else if (tag === 'h2') level = 2;
      else if (tag === 'h3' || tag === 'h4') level = 3;
      else {
        var m = text.match(/^(\d+)[\.、．]\s+\S/) || text.match(/^([一二三四五六七八九十]+)[、.．]\s*\S/);
        if (!m) continue;
        level = 2;
      }
      var key = level + ':' + text.slice(0, 40);
      if (seen[key]) continue;
      seen[key] = true;
      if (!node.id) node.id = NS + '-h-' + items.length + '-' + Math.abs(hash(text));
      items.push({ id: node.id, text: text.slice(0, 80), level: level, el: node });
      if (items.length >= 80) break;
    }
    return items;
  }

  function hash(s) {
    var h = 0;
    for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
    return h;
  }

  // ---- preferences ----
  var WIDTH_KEY = 'mdlitePageWidth';
  var READER_WIDTH_KEY = 'mdliteReaderWidth';
  var WIDTH_ORDER = ['normal', 'wide', 'full'];
  var WIDTH_LABEL = { normal: '标准', wide: '较宽', full: '铺满' };
  function normWidth(v) {
    return WIDTH_ORDER.indexOf(v) >= 0 ? v : 'normal';
  }
  function nextWidth(v) {
    return WIDTH_ORDER[(WIDTH_ORDER.indexOf(normWidth(v)) + 1) % WIDTH_ORDER.length];
  }
  var pageWidth = normWidth(storeGet(WIDTH_KEY, 'normal'));
  var readerWidth = normWidth(storeGet(READER_WIDTH_KEY, 'normal'));
  var outlinePinned = storeGet(PIN_KEY, false) === true;

  // ---- styles ----
  // Page-width selectors: extension ChatGPTPageWidthController + older Tailwind shapes.
  var PAGE_WIDTH_SELECTORS = [
    '[class*="max-w-(--thread-content-max-width)"]',
    '[class*="max-w-[var(--thread-content-max-width)]"]',
    'main .text-token-text-primary > div > div',
    'main [class*="xl:max-w-[48rem]"]',
    'main [class*="md:max-w-3xl"]',
  ];
  function widthRule(mode, value) {
    var sel = PAGE_WIDTH_SELECTORS.map(function (x) {
      return 'html[data-mdlite-width="' + mode + '"] ' + x;
    }).join(',');
    return sel + '{max-width:' + value + '!important;--thread-content-max-width:' + value + '!important}';
  }

  function ensureStyle() {
    var existing = document.getElementById(NS + '-style');
    if (existing && existing.isConnected) return;
    var s = document.createElement('style');
    s.id = NS + '-style';
    var P = '.' + NS;
    function dark(scope) {
      var Q = scope + ' ' + P;
      return [
        Q + '-chip,' + Q + '-fab button.secondary,' + Q + '-panel,' + Q + '-panel__head,' + Q + '-rail,' + Q + '-menu{',
        'background:#1e1e1e;color:#f2f2f2;border-color:rgba(255,255,255,.14)}',
        Q + '-chip:hover,' + Q + '-rail__list button:hover,' + Q + '-menu button:hover{background:#2a2a2a}',
        Q + '-menu button{color:#f2f2f2}',
        Q + '-menu button[aria-pressed="true"],' + Q + '-menu button[aria-checked="true"]{background:#f2f2f2;color:#111}',
        Q + '-menu small{color:#aaa}',
      ].join('');
    }
    s.textContent = [
      P + '-chip{position:fixed;z-index:2147483000;',
      'display:inline-flex;align-items:center;gap:6px;padding:6px 10px;border-radius:999px;',
      'border:1px solid rgba(0,0,0,.12);background:#fff;color:#111;font:12px/1.2 system-ui,sans-serif;',
      'box-shadow:0 4px 14px rgba(0,0,0,.12);cursor:pointer;user-select:none}',
      P + '-chip[hidden],' + P + '-menu[hidden]{display:none!important}',
      P + '-chip[data-fixed="1"]{right:16px;bottom:96px;top:auto!important;left:auto!important}',
      P + '-chip:hover{background:#f6f7f9}',
      P + '-fab{position:fixed;right:16px;bottom:40px;z-index:2147483000;',
      'display:inline-flex;gap:6px;align-items:center}',
      P + '-fab button{padding:8px 12px;border-radius:10px;border:1px solid rgba(0,0,0,.14);',
      'background:#111;color:#fff;font:12px/1.2 system-ui,sans-serif;cursor:pointer;',
      'box-shadow:0 4px 14px rgba(0,0,0,.18)}',
      P + '-fab button.secondary{background:#fff;color:#111}',
      P + '-menu{position:fixed;right:16px;bottom:84px;z-index:2147483001;min-width:220px;',
      'padding:8px;border-radius:12px;border:1px solid rgba(0,0,0,.12);background:#fff;color:#111;',
      'box-shadow:0 10px 30px rgba(0,0,0,.2);font:13px/1.35 system-ui,sans-serif}',
      P + '-menu__row{display:flex;align-items:center;gap:6px;padding:2px 0}',
      P + '-menu__label{flex:0 0 auto;padding:6px 8px;opacity:.8}',
      P + '-menu button{display:block;width:100%;text-align:left;border:0;background:transparent;',
      'padding:7px 10px;border-radius:8px;cursor:pointer;color:#111;font:13px/1.3 system-ui,sans-serif}',
      P + '-menu__row button{width:auto;flex:1;text-align:center;padding:6px 8px;border:1px solid rgba(127,127,127,.25)}',
      P + '-menu button:hover{background:#f2f3f5}',
      P + '-menu button[aria-pressed="true"],' + P + '-menu button[aria-checked="true"]{background:#111;color:#fff}',
      P + '-menu hr{border:0;border-top:1px solid rgba(127,127,127,.2);margin:6px 0}',
      P + '-menu small{display:block;padding:4px 10px;color:#666;font-size:11px}',
      P + '-panel{position:fixed;top:0;right:0;bottom:0;width:min(420px,92vw);z-index:2147483001;',
      'display:flex;flex-direction:column;background:#fafafa;color:#111;',
      'border-left:1px solid rgba(0,0,0,.12);box-shadow:-8px 0 24px rgba(0,0,0,.12);',
      'font:14px/1.5 system-ui,sans-serif}',
      P + '-panel[data-width="wide"]{width:min(760px,94vw)}',
      P + '-panel[data-width="full"]{width:96vw}',
      P + '-panel[hidden]{display:none!important}',
      P + '-panel__head{display:flex;align-items:center;gap:8px;padding:12px 14px;',
      'border-bottom:1px solid rgba(0,0,0,.08);background:#fff}',
      P + '-panel__head strong{flex:1}',
      P + '-panel__body{flex:1;overflow:auto;padding:16px 18px}',
      P + '-panel[data-rail-pinned="1"] ' + P + '-panel__body{margin-right:200px}',
      P + '-panel__body h1,' + P + '-panel__body h2,' + P + '-panel__body h3{scroll-margin-top:12px}',
      P + '-panel__body pre{white-space:pre-wrap;overflow:auto}',
      P + '-panel__body img{max-width:100%}',
      P + '-rail{position:absolute;top:56px;right:0;bottom:0;width:28px;',
      'border-left:1px solid rgba(0,0,0,.06);background:rgba(255,255,255,.92);',
      'overflow:hidden;transition:width .15s ease}',
      P + '-rail[data-pinned="1"],' + P + '-rail:hover,' + P + '-rail:focus-within{width:200px}',
      P + '-rail__head{display:flex;align-items:center;justify-content:flex-end;padding:6px}',
      P + '-rail__list{list-style:none;margin:0;padding:4px 8px 12px;overflow:auto;height:calc(100% - 36px)}',
      P + '-rail__list button{display:block;width:100%;text-align:left;border:0;background:transparent;',
      'padding:4px 6px;border-radius:6px;font:11px/1.3 system-ui,sans-serif;color:inherit;cursor:pointer;',
      'white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
      P + '-rail__list button:hover{background:rgba(0,0,0,.06)}',
      P + '-rail__list button[data-level="1"]{font-weight:600}',
      P + '-rail__list button[data-level="3"]{padding-left:14px;opacity:.9}',
      P + '-pin{border:0;background:transparent;color:inherit;cursor:pointer;padding:4px 6px;border-radius:6px;font:12px/1.2 system-ui,sans-serif}',
      P + '-pin[aria-pressed="true"]{background:#111;color:#fff}',
      P + '-toast{position:fixed;left:50%;bottom:24px;transform:translateX(-50%);z-index:2147483002;',
      'display:flex;gap:10px;align-items:center;max-width:min(520px,92vw);padding:10px 14px;',
      'border-radius:10px;background:#111;color:#fff;font:13px/1.3 system-ui,sans-serif;',
      'box-shadow:0 8px 24px rgba(0,0,0,.25)}',
      P + '-toast button{border:0;border-radius:6px;padding:4px 8px;cursor:pointer;',
      'background:#fff;color:#111;font:12px/1.2 system-ui,sans-serif}',
      widthRule('wide', 'min(1200px, 100%)'),
      widthRule('full', '100%'),
      dark('html.dark'),
      '@media (prefers-color-scheme: dark){' + dark('html:not(.light)') + '}',
    ].join('');
    document.documentElement.appendChild(s);
  }

  // ---- page width ----
  function applyPageWidth() {
    var html = document.documentElement;
    if (pageWidth === 'normal') {
      if (html.hasAttribute('data-mdlite-width')) html.removeAttribute('data-mdlite-width');
    } else if (html.getAttribute('data-mdlite-width') !== pageWidth) {
      html.setAttribute('data-mdlite-width', pageWidth);
    }
  }
  function setPageWidth(mode, silent) {
    pageWidth = normWidth(mode);
    storeSet(WIDTH_KEY, pageWidth);
    applyPageWidth();
    syncFab();
    syncMenu();
    scheduleChip();
    if (!silent) toast('页面宽度：' + WIDTH_LABEL[pageWidth], { durationMs: 1800 });
  }

  // ---- reader panel ----
  var panel = null;
  var panelBody = null;
  var rail = null;
  var railList = null;
  var pinBtn = null;
  var readerWidthBtn = null;
  var currentRoot = null;

  function ensurePanel() {
    if (panel) {
      if (!panel.isConnected) document.documentElement.appendChild(panel);
      return panel;
    }
    panel = document.createElement('aside');
    panel.className = NS + '-panel';
    panel.hidden = true;
    panel.setAttribute('aria-label', 'MarkDone Lite 阅读器');

    var head = document.createElement('div');
    head.className = NS + '-panel__head';
    var title = document.createElement('strong');
    title.textContent = 'MarkDone Lite 阅读器';
    readerWidthBtn = document.createElement('button');
    readerWidthBtn.type = 'button';
    readerWidthBtn.className = NS + '-pin';
    readerWidthBtn.addEventListener('click', function () {
      readerWidth = nextWidth(readerWidth);
      storeSet(READER_WIDTH_KEY, readerWidth);
      syncReaderWidth();
    });
    var close = document.createElement('button');
    close.type = 'button';
    close.className = NS + '-pin';
    close.textContent = '关闭';
    close.addEventListener('click', function () {
      panel.hidden = true;
      scheduleChip();
    });
    head.appendChild(title);
    head.appendChild(readerWidthBtn);
    head.appendChild(close);

    panelBody = document.createElement('div');
    panelBody.className = NS + '-panel__body';

    rail = document.createElement('nav');
    rail.className = NS + '-rail';
    rail.setAttribute('aria-label', '大纲');
    var railHead = document.createElement('div');
    railHead.className = NS + '-rail__head';
    pinBtn = document.createElement('button');
    pinBtn.type = 'button';
    pinBtn.className = NS + '-pin';
    pinBtn.addEventListener('click', function () {
      setOutlinePinned(!outlinePinned, true);
    });
    railHead.appendChild(pinBtn);
    railList = document.createElement('div');
    railList.className = NS + '-rail__list';
    rail.appendChild(railHead);
    rail.appendChild(railList);

    panel.appendChild(head);
    panel.appendChild(panelBody);
    panel.appendChild(rail);
    document.documentElement.appendChild(panel);
    syncPinUi();
    syncReaderWidth();
    return panel;
  }

  function syncReaderWidth() {
    if (!panel || !readerWidthBtn) return;
    panel.dataset.width = readerWidth;
    readerWidthBtn.textContent = '宽度·' + WIDTH_LABEL[readerWidth];
    readerWidthBtn.title = '阅读器宽度：标准 → 较宽 → 铺满';
  }

  function setOutlinePinned(v, silent) {
    outlinePinned = !!v;
    storeSet(PIN_KEY, outlinePinned);
    syncPinUi();
    syncMenu();
    if (!silent) toast(outlinePinned ? '大纲已钉住（阅读器右侧常显）' : '大纲改为悬停展开', { durationMs: 2000 });
  }

  function syncPinUi() {
    if (!rail || !pinBtn) return;
    rail.dataset.pinned = outlinePinned ? '1' : '0';
    panel.dataset.railPinned = outlinePinned ? '1' : '0';
    pinBtn.setAttribute('aria-pressed', outlinePinned ? 'true' : 'false');
    pinBtn.title = outlinePinned ? '已钉住，点击改为悬停展开' : '钉住大纲';
    pinBtn.setAttribute('aria-label', pinBtn.title);
    pinBtn.textContent = outlinePinned ? '📌' : '📍';
  }

  function openReader(root) {
    ensurePanel();
    currentRoot = root;
    var source = root.querySelector(CONTENT_SELECTOR) || root;
    var clone = source.cloneNode(true);
    // Drop interactive chrome from clone.
    var junk = clone.querySelectorAll('button, textarea, input, [class*="' + NS + '-"]');
    for (var i = 0; i < junk.length; i++) junk[i].remove();
    panelBody.innerHTML = '';
    panelBody.appendChild(clone);

    var items = buildOutline(panelBody);
    railList.innerHTML = '';
    for (var j = 0; j < items.length; j++) {
      (function (item) {
        var b = document.createElement('button');
        b.type = 'button';
        b.dataset.level = String(item.level);
        b.textContent = item.text;
        b.title = item.text;
        b.addEventListener('click', function () {
          var target = panelBody.querySelector('#' + CSS.escape(item.id));
          if (target) target.scrollIntoView({ block: 'start', behavior: 'smooth' });
        });
        railList.appendChild(b);
      })(items[j]);
    }
    if (!items.length) {
      var empty = document.createElement('small');
      empty.style.cssText = 'display:block;padding:4px 6px;opacity:.6;white-space:normal';
      empty.textContent = '此回复无标题/编号段落';
      railList.appendChild(empty);
    }
    panelBody.scrollTop = 0;
    panel.hidden = false;
    syncPinUi();
    syncReaderWidth();
    closeMenu();
  }

  function openReaderForCurrent() {
    var target = bound && bound.root && bound.root.isConnected ? bound.root : null;
    if (!target) {
      var p = resolvePrimary(collectRounds());
      if (p) target = p.root;
    }
    if (!target) {
      var all = assistantRoots();
      if (all.length) target = all[all.length - 1];
    }
    if (!target) {
      toast('没在当前页面找到助手回复（可能是新对话，或 ChatGPT DOM 改版）。请截图反馈。', { durationMs: 6000 });
      return;
    }
    openReader(target);
  }

  // ---- viewport chip ----
  var chip = null;
  var pending = null;
  var pendingSince = 0;
  var bound = null;
  var raf = 0;

  function ensureChip() {
    if (chip) {
      if (!chip.isConnected) document.documentElement.appendChild(chip);
      return chip;
    }
    chip = document.createElement('button');
    chip.type = 'button';
    chip.className = NS + '-chip';
    chip.textContent = '📖 阅读器';
    chip.title = 'MarkDone Lite：在侧栏阅读这条回复（含大纲）';
    chip.hidden = true;
    chip.addEventListener('click', function () {
      if (!bound || !bound.root) return;
      openReader(bound.root);
    });
    document.documentElement.appendChild(chip);
    return chip;
  }

  function placeChip(round, fixed) {
    ensureChip();
    if (!round || (panel && !panel.hidden)) {
      chip.hidden = true;
      return;
    }
    chip.hidden = false;
    if (fixed) {
      chip.dataset.fixed = '1';
      chip.style.top = '';
      chip.style.left = '';
      return;
    }
    chip.dataset.fixed = '0';
    // Viewport (fixed) coords: ChatGPT scrolls an inner container, not window.
    var rect = round.root.getBoundingClientRect();
    var vw = window.innerWidth;
    var vh = window.innerHeight;
    var cw = chip.offsetWidth || 90;
    var ch = chip.offsetHeight || 28;
    var top = Math.min(Math.max(rect.top, 64), Math.min(rect.bottom - ch, vh - ch - 110));
    if (!Number.isFinite(top)) top = 64;
    var left = rect.right + 8;
    if (left + cw > vw - 8) left = Math.max(8, Math.min(rect.right, vw - 8) - cw - 8);
    chip.style.top = Math.round(top) + 'px';
    chip.style.left = Math.round(left) + 'px';
  }

  function refreshChip() {
    raf = 0;
    var rounds = collectRounds();
    var primary = resolvePrimary(rounds);
    var narrow = window.innerWidth < NARROW_PX;
    var now = Date.now();
    if (!primary) {
      bound = null;
      placeChip(null, false);
      return;
    }
    var same = bound && bound.root === primary.root && bound.id === primary.id;
    if (!same) {
      if (!pending || pending.root !== primary.root) {
        pending = primary;
        pendingSince = now;
      }
      if (now - pendingSince < HYSTERESIS_MS && bound && bound.root.isConnected) {
        placeChip(bound, narrow);
        if (!raf) setTimeout(scheduleChip, HYSTERESIS_MS);
        return;
      }
      bound = primary;
      pending = null;
    }
    placeChip(bound, narrow);
  }

  function scheduleChip() {
    if (raf) return;
    raf = requestAnimationFrame(refreshChip);
  }

  // ---- soft refresh ----
  var lastRoundCount = 0;

  function softRefresh() {
    // Lite: rescan mounted assistants and refresh chip; no location.assign.
    closeMenu();
    var before = lastRoundCount;
    bound = null;
    pending = null;
    var rounds = collectRounds();
    lastRoundCount = rounds.length;
    applyPageWidth();
    scheduleChip();
    if (currentRoot && !currentRoot.isConnected && panel && !panel.hidden) {
      toast('当前阅读消息已离开 DOM，请重新打开阅读器。', { durationMs: 4000 });
    }
    var navItems = document.querySelectorAll(
      'nav [data-testid*="conversation"], nav a[href*="#"], [class*="scroll"] button',
    );
    var gaps = navItems.length > 0 && rounds.length + 2 < navItems.length && rounds.length < before;
    toast(
      gaps
        ? '部分消息可能尚未挂载。可先滚动再软刷新。'
        : '已软刷新消息导航（' + rounds.length + ' 条助手回复）。',
      {
        durationMs: gaps ? 8000 : 3500,
        actionLabel: gaps ? '仍可整页刷新' : null,
        onAction: gaps
          ? function () {
              location.reload();
            }
          : null,
      },
    );
  }

  // ---- FAB + Lite menu ----
  var fab = null;
  var fabWidthBtn = null;
  var menu = null;

  function mkBtn(text, title, onClick, cls) {
    var b = document.createElement('button');
    b.type = 'button';
    b.textContent = text;
    if (title) b.title = title;
    if (cls) b.className = cls;
    b.addEventListener('click', function (e) {
      e.stopPropagation();
      onClick(e);
    });
    return b;
  }

  function ensureFab() {
    if (fab) {
      if (!fab.isConnected) document.documentElement.appendChild(fab);
      return;
    }
    fab = document.createElement('div');
    fab.id = NS + '-fab';
    fab.className = NS + '-fab';
    var reader = mkBtn('📖 阅读器', '在侧栏阅读当前回复（含大纲）', openReaderForCurrent, 'secondary');
    fabWidthBtn = mkBtn('', '页面宽度：标准 → 较宽 → 铺满（会记住）', function () {
      setPageWidth(nextWidth(pageWidth));
    }, 'secondary');
    fabWidthBtn.setAttribute('data-role', 'width');
    var more = mkBtn('Lite ☰', 'MarkDone Lite 菜单', toggleMenu);
    more.setAttribute('data-role', 'menu');
    fab.appendChild(reader);
    fab.appendChild(fabWidthBtn);
    fab.appendChild(more);
    document.documentElement.appendChild(fab);
    syncFab();
  }

  function syncFab() {
    if (!fabWidthBtn) return;
    fabWidthBtn.textContent = '↔ 宽度·' + WIDTH_LABEL[pageWidth];
    fabWidthBtn.setAttribute('aria-label', '页面宽度：' + WIDTH_LABEL[pageWidth]);
  }

  function ensureMenu() {
    if (menu) {
      if (!menu.isConnected) document.documentElement.appendChild(menu);
      return menu;
    }
    menu = document.createElement('div');
    menu.className = NS + '-menu';
    menu.setAttribute('role', 'menu');
    menu.hidden = true;
    menu.addEventListener('click', function (e) {
      e.stopPropagation();
    });
    document.documentElement.appendChild(menu);
    return menu;
  }

  function renderMenu() {
    ensureMenu();
    menu.innerHTML = '';
    menu.appendChild(mkBtn('📖 阅读器（当前回复）', '在侧栏打开视口内主读回复', openReaderForCurrent));
    var pin = mkBtn(
      (outlinePinned ? '📌 大纲钉住：开' : '📍 大纲钉住：关'),
      '阅读器右侧大纲常显 / 悬停展开',
      function () {
        setOutlinePinned(!outlinePinned);
      },
    );
    pin.setAttribute('aria-checked', outlinePinned ? 'true' : 'false');
    pin.setAttribute('role', 'menuitemcheckbox');
    menu.appendChild(pin);
    var row = document.createElement('div');
    row.className = NS + '-menu__row';
    var lab = document.createElement('span');
    lab.className = NS + '-menu__label';
    lab.textContent = '↔ 宽度';
    row.appendChild(lab);
    WIDTH_ORDER.forEach(function (m) {
      var b = mkBtn(WIDTH_LABEL[m], '页面宽度：' + WIDTH_LABEL[m], function () {
        setPageWidth(m);
      });
      b.setAttribute('data-width', m);
      b.setAttribute('aria-pressed', pageWidth === m ? 'true' : 'false');
      row.appendChild(b);
    });
    menu.appendChild(row);
    menu.appendChild(mkBtn('🔄 软刷新导航', '重扫已挂载消息，不整页刷新', softRefresh));
    menu.appendChild(document.createElement('hr'));
    var info = document.createElement('small');
    info.textContent =
      'Lite v' + VERSION + ' · 检测到 ' + assistantRoots().length + ' 条助手回复' +
      (document.querySelector(PAGE_WIDTH_SELECTORS.join(',')) ? '' : ' · 未找到宽度容器');
    menu.appendChild(info);
  }

  function syncMenu() {
    if (menu && !menu.hidden) renderMenu();
  }
  function toggleMenu() {
    ensureMenu();
    if (menu.hidden) {
      renderMenu();
      menu.hidden = false;
    } else {
      menu.hidden = true;
    }
  }
  function closeMenu() {
    if (menu) menu.hidden = true;
  }

  // ---- watchdog: survive SPA navigation / React re-render ----
  var lastHref = location.href;
  function ensureAll() {
    ensureStyle();
    ensureChip();
    ensureFab();
    if (menu && !menu.isConnected) document.documentElement.appendChild(menu);
    if (panel && !panel.isConnected) document.documentElement.appendChild(panel);
    applyPageWidth();
    if (location.href !== lastHref) {
      lastHref = location.href;
      bound = null;
      pending = null;
      closeMenu();
      if (panel && !panel.hidden && currentRoot && !currentRoot.isConnected) panel.hidden = true;
    }
  }

  // ---- boot ----
  function boot() {
    ensureAll();
    lastRoundCount = collectRounds().length;
    scheduleChip();
    window.addEventListener('scroll', scheduleChip, { capture: true, passive: true });
    document.addEventListener('scroll', scheduleChip, { capture: true, passive: true });
    window.addEventListener('resize', scheduleChip, { passive: true });
    window.addEventListener('popstate', function () {
      setTimeout(ensureAll, 0);
      scheduleChip();
    });
    document.addEventListener('click', closeMenu);
    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape') return;
      if (menu && !menu.hidden) closeMenu();
      else if (panel && !panel.hidden) {
        panel.hidden = true;
        scheduleChip();
      }
    });
    var moTimer = 0;
    var mo = new MutationObserver(function () {
      scheduleChip();
      if (moTimer) return;
      moTimer = setTimeout(function () {
        moTimer = 0;
        ensureAll();
      }, 250);
    });
    mo.observe(document.documentElement, { childList: true, subtree: true });
    setInterval(ensureAll, 1500);
    console.info('[MarkDone Lite]', VERSION, 'booted;', assistantRoots().length, 'assistant nodes; width=' + pageWidth);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();
