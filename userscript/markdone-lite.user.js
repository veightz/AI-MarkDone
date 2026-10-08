// ==UserScript==
// @name         MarkDone Lite
// @namespace    https://github.com/veightz/AI-MarkDone
// @updateURL    https://raw.githubusercontent.com/veightz/AI-MarkDone/main/userscript/markdone-lite.user.js
// @downloadURL  https://raw.githubusercontent.com/veightz/AI-MarkDone/main/userscript/markdone-lite.user.js
// @version      0.1.202610081629
// @description  ChatGPT 日用子集：视口跟随阅读器、大纲钉住、软刷新消息导航（非全功能扩展）
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

  var VERSION = '0.1.202610081629';
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
  function assistantRoots() {
    var nodes = document.querySelectorAll('[data-message-author-role="assistant"]');
    var out = [];
    for (var i = 0; i < nodes.length; i++) {
      var n = nodes[i];
      if (!(n instanceof HTMLElement)) continue;
      if (!n.isConnected) continue;
      // Prefer outermost role node when nested.
      var parentRole = n.parentElement && n.parentElement.closest('[data-message-author-role="assistant"]');
      if (parentRole && parentRole !== n) continue;
      out.push(n);
    }
    return out;
  }

  function isStreaming(el) {
    if (!el) return true;
    if (el.querySelector('.result-streaming, [data-is-streaming="true"]')) return true;
    var turn = el.closest('[data-testid^="conversation-turn"]') || el;
    if (turn.getAttribute('data-is-streaming') === 'true') return true;
    return false;
  }

  function collectRounds() {
    var roots = assistantRoots();
    var rounds = [];
    for (var i = 0; i < roots.length; i++) {
      var root = roots[i];
      if (isStreaming(root)) continue;
      var rect = root.getBoundingClientRect();
      if (!Number.isFinite(rect.top) || rect.height <= 0 && rect.width <= 0) continue;
      rounds.push({
        index: i,
        root: root,
        top: rect.top,
        bottom: rect.bottom,
        id: root.getAttribute('data-message-id') || root.id || String(i),
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
    var content =
      root.querySelector('.markdown, .prose, [class*="markdown"]') || root;
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

  // ---- styles ----
  function ensureStyle() {
    if (document.getElementById(NS + '-style')) return;
    var s = document.createElement('style');
    s.id = NS + '-style';
    s.textContent = [
      '.' + NS + '-chip{position:absolute;z-index:2147483000;transform:translate(8px,-8px);',
      'display:inline-flex;align-items:center;gap:6px;padding:6px 10px;border-radius:999px;',
      'border:1px solid rgba(0,0,0,.12);background:#fff;color:#111;font:12px/1.2 system-ui,sans-serif;',
      'box-shadow:0 4px 14px rgba(0,0,0,.12);cursor:pointer;user-select:none}',
      '.' + NS + '-chip[data-fixed="1"]{position:fixed;right:16px;bottom:88px;transform:none}',
      '.' + NS + '-chip:hover{background:#f6f7f9}',
      '.' + NS + '-fab{position:fixed;right:16px;bottom:40px;z-index:2147483000;',
      'display:inline-flex;gap:8px;align-items:center}',
      '.' + NS + '-fab button{padding:8px 12px;border-radius:10px;border:1px solid rgba(0,0,0,.14);',
      'background:#111;color:#fff;font:12px/1.2 system-ui,sans-serif;cursor:pointer;',
      'box-shadow:0 4px 14px rgba(0,0,0,.18)}',
      '.' + NS + '-fab button.secondary{background:#fff;color:#111}',
      '.' + NS + '-panel{position:fixed;top:0;right:0;bottom:0;width:min(420px,92vw);z-index:2147483001;',
      'display:flex;flex-direction:column;background:#fafafa;color:#111;',
      'border-left:1px solid rgba(0,0,0,.12);box-shadow:-8px 0 24px rgba(0,0,0,.12);',
      'font:14px/1.5 system-ui,sans-serif}',
      '.' + NS + '-panel[hidden]{display:none!important}',
      '.' + NS + '-panel__head{display:flex;align-items:center;gap:8px;padding:12px 14px;',
      'border-bottom:1px solid rgba(0,0,0,.08);background:#fff}',
      '.' + NS + '-panel__head strong{flex:1}',
      '.' + NS + '-panel__body{flex:1;overflow:auto;padding:16px 18px}',
      '.' + NS + '-panel__body h1,.' + NS + '-panel__body h2,.' + NS + '-panel__body h3{scroll-margin-top:12px}',
      '.' + NS + '-rail{position:absolute;top:56px;right:0;bottom:0;width:28px;',
      'border-left:1px solid rgba(0,0,0,.06);background:rgba(255,255,255,.92);',
      'overflow:hidden;transition:width .15s ease}',
      '.' + NS + '-rail[data-pinned="1"],.' + NS + '-rail:hover,.' + NS + '-rail:focus-within{width:200px}',
      '.' + NS + '-rail__head{display:flex;align-items:center;justify-content:flex-end;padding:6px}',
      '.' + NS + '-rail__list{list-style:none;margin:0;padding:4px 8px 12px;overflow:auto;height:calc(100% - 36px)}',
      '.' + NS + '-rail__list button{display:block;width:100%;text-align:left;border:0;background:transparent;',
      'padding:4px 6px;border-radius:6px;font:11px/1.3 system-ui,sans-serif;color:#333;cursor:pointer;',
      'white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
      '.' + NS + '-rail__list button:hover{background:rgba(0,0,0,.06)}',
      '.' + NS + '-rail__list button[data-level="1"]{font-weight:600}',
      '.' + NS + '-rail__list button[data-level="3"]{padding-left:14px;opacity:.9}',
      '.' + NS + '-pin{border:0;background:transparent;cursor:pointer;padding:4px 6px;border-radius:6px}',
      '.' + NS + '-pin[aria-pressed="true"]{background:#111;color:#fff}',
      '.' + NS + '-toast{position:fixed;left:50%;bottom:24px;transform:translateX(-50%);z-index:2147483002;',
      'display:flex;gap:10px;align-items:center;max-width:min(520px,92vw);padding:10px 14px;',
      'border-radius:10px;background:#111;color:#fff;font:13px/1.3 system-ui,sans-serif;',
      'box-shadow:0 8px 24px rgba(0,0,0,.25)}',
      '.' + NS + '-toast button{border:0;border-radius:6px;padding:4px 8px;cursor:pointer;',
      'background:#fff;color:#111;font:12px/1.2 system-ui,sans-serif}',
      '@media (prefers-color-scheme: dark){',
      '.' + NS + '-chip,.' + NS + '-fab button.secondary,.' + NS + '-panel,.' + NS + '-panel__head,.' + NS + '-rail{',
      'background:#1e1e1e;color:#f2f2f2;border-color:rgba(255,255,255,.12)}',
      '.' + NS + '-chip:hover,.' + NS + '-rail__list button:hover{background:#2a2a2a}',
      '}',
    ].join('');
    document.documentElement.appendChild(s);
  }

  // ---- reader panel ----
  var panel = null;
  var panelBody = null;
  var rail = null;
  var railList = null;
  var pinBtn = null;
  var outlinePinned = storeGet(PIN_KEY, false) === true;
  var currentRoot = null;

  function ensurePanel() {
    if (panel) return panel;
    panel = document.createElement('aside');
    panel.className = NS + '-panel';
    panel.hidden = true;
    panel.setAttribute('aria-label', 'MarkDone Lite 阅读器');

    var head = document.createElement('div');
    head.className = NS + '-panel__head';
    var title = document.createElement('strong');
    title.textContent = 'MarkDone Lite';
    var close = document.createElement('button');
    close.type = 'button';
    close.className = NS + '-pin';
    close.textContent = '关闭';
    close.addEventListener('click', function () {
      panel.hidden = true;
    });
    head.appendChild(title);
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
      outlinePinned = !outlinePinned;
      storeSet(PIN_KEY, outlinePinned);
      syncPinUi();
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
    return panel;
  }

  function syncPinUi() {
    if (!rail || !pinBtn) return;
    rail.dataset.pinned = outlinePinned ? '1' : '0';
    pinBtn.setAttribute('aria-pressed', outlinePinned ? 'true' : 'false');
    pinBtn.title = outlinePinned ? '动态缩放' : '钉住大纲';
    pinBtn.setAttribute('aria-label', pinBtn.title);
    pinBtn.textContent = outlinePinned ? '📌' : '📍';
  }

  function openReader(root) {
    ensurePanel();
    currentRoot = root;
    var clone = root.cloneNode(true);
    // Drop interactive chrome from clone.
    var junk = clone.querySelectorAll('button, textarea, input, .' + NS + '-chip');
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
    panel.hidden = false;
    syncPinUi();
  }

  // ---- viewport chip ----
  var chip = null;
  var pending = null;
  var pendingSince = 0;
  var bound = null;
  var raf = 0;

  function ensureChip() {
    if (chip) return chip;
    chip = document.createElement('button');
    chip.type = 'button';
    chip.className = NS + '-chip';
    chip.textContent = '阅读器';
    chip.title = 'MarkDone Lite 阅读器（油猴）';
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
    if (!round) {
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
    var rect = round.root.getBoundingClientRect();
    var top = rect.top + window.scrollY;
    var left = rect.right + window.scrollX;
    // Keep chip inside viewport horizontally when possible.
    var maxLeft = window.scrollX + window.innerWidth - 120;
    if (left > maxLeft) left = Math.max(window.scrollX + 8, rect.left + window.scrollX);
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
    var same =
      bound &&
      bound.root === primary.root &&
      bound.id === primary.id;
    if (!same) {
      if (!pending || pending.root !== primary.root) {
        pending = primary;
        pendingSince = now;
      }
      if (now - pendingSince < HYSTERESIS_MS && bound) {
        placeChip(bound, narrow);
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
    var before = lastRoundCount;
    var rounds = collectRounds();
    lastRoundCount = rounds.length;
    scheduleChip();
    if (currentRoot && !currentRoot.isConnected && panel && !panel.hidden) {
      toast('当前阅读消息已离开 DOM，请重新打开阅读器。', { durationMs: 4000 });
    }
    // Heuristic gap: official nav items outnumber mounted assistants.
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
              var u = new URL(location.href);
              u.searchParams.set('message', '');
              location.assign(u.toString());
            }
          : null,
      },
    );
  }

  function ensureFab() {
    if (document.getElementById(NS + '-fab')) return;
    var fab = document.createElement('div');
    fab.id = NS + '-fab';
    fab.className = NS + '-fab';
    var refresh = document.createElement('button');
    refresh.type = 'button';
    refresh.textContent = '软刷新导航';
    refresh.title = '重扫已挂载消息，不整页刷新';
    refresh.addEventListener('click', softRefresh);
    var about = document.createElement('button');
    about.type = 'button';
    about.className = 'secondary';
    about.textContent = 'Lite ' + VERSION.replace(/^0\.1\./, '');
    about.title = 'MarkDone Lite — 非全功能扩展';
    about.addEventListener('click', function () {
      toast('MarkDone Lite v' + VERSION + ' · 仅日用阅读子集', { durationMs: 4000 });
    });
    fab.appendChild(refresh);
    fab.appendChild(about);
    document.documentElement.appendChild(fab);
  }

  // ---- boot ----
  function boot() {
    ensureStyle();
    ensureChip();
    ensureFab();
    lastRoundCount = collectRounds().length;
    scheduleChip();
    window.addEventListener('scroll', scheduleChip, { capture: true, passive: true });
    document.addEventListener('scroll', scheduleChip, { capture: true, passive: true });
    window.addEventListener('resize', scheduleChip, { passive: true });
    var mo = new MutationObserver(function () {
      scheduleChip();
    });
    mo.observe(document.body || document.documentElement, {
      childList: true,
      subtree: true,
    });
    console.info('[MarkDone Lite]', VERSION, 'booted');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();
