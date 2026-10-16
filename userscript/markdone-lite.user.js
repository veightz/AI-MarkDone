// ==UserScript==
// @name         MarkDone Lite
// @namespace    https://github.com/veightz/AI-MarkDone
// @updateURL    https://raw.githubusercontent.com/veightz/AI-MarkDone/main/userscript/markdone-lite.user.js
// @downloadURL  https://raw.githubusercontent.com/veightz/AI-MarkDone/main/userscript/markdone-lite.user.js
// @version      0.1.202610161715
// @description  ChatGPT 日用子集：视口跟随阅读器、大纲钉住、页面宽度、软刷新、消息步进、字数统计、复制 Markdown、Cmd/Ctrl+Enter 发送、设置面板（非全功能扩展）
// @author       veightz
// @match        *://chatgpt.com/*
// @match        *://chat.openai.com/*
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
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

  var VERSION = '0.1.202610161715';
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
  var ACTIVE_PAGE_ATTR = 'data-app-shell-active-page';

  // Thin active-main resolver (upstream idea only — not a port of its TS module).
  // Prefer the unique main under data-app-shell-active-page="true"; else first visible main.
  var cachedActiveMain = null;
  var cachedActiveEpoch = 0;

  function isDisplayed(el) {
    if (!(el instanceof HTMLElement) || !el.isConnected) return false;
    try {
      if (window.getComputedStyle(el).display === 'none') return false;
    } catch (_) {
      return false;
    }
    var rect = el.getBoundingClientRect();
    return Number.isFinite(rect.width) && Number.isFinite(rect.height);
  }

  function resolveActiveMain() {
    var owners = document.querySelectorAll('[' + ACTIVE_PAGE_ATTR + ']');
    if (owners.length > 0) {
      var active = [];
      for (var i = 0; i < owners.length; i++) {
        var o = owners[i];
        if (o instanceof HTMLElement && o.getAttribute(ACTIVE_PAGE_ATTR) === 'true') active.push(o);
      }
      if (active.length === 1) {
        var owner = active[0];
        var nested = false;
        for (var j = 0; j < owners.length; j++) {
          var other = owners[j];
          if (other !== owner && (owner.contains(other) || other.contains(owner))) {
            nested = true;
            break;
          }
        }
        if (!nested) {
          var mains = owner.matches('main') ? [owner] : Array.prototype.slice.call(owner.querySelectorAll('main'));
          if (mains.length === 1 && mains[0] instanceof HTMLElement) {
            cachedActiveMain = mains[0];
            return cachedActiveMain;
          }
        }
      }
    }
    var allMains = document.querySelectorAll('main');
    for (var k = 0; k < allMains.length; k++) {
      var m = allMains[k];
      if (isDisplayed(m)) {
        cachedActiveMain = m;
        return cachedActiveMain;
      }
    }
    cachedActiveMain = allMains[0] instanceof HTMLElement ? allMains[0] : null;
    return cachedActiveMain;
  }

  function getActiveMain() {
    if (cachedActiveMain && cachedActiveMain.isConnected) {
      // Re-check marker still matches when present.
      var owner = cachedActiveMain.closest('[' + ACTIVE_PAGE_ATTR + ']');
      if (!owner || owner.getAttribute(ACTIVE_PAGE_ATTR) === 'true') return cachedActiveMain;
    }
    return resolveActiveMain();
  }

  function invalidateActiveMain() {
    cachedActiveMain = null;
    cachedActiveEpoch += 1;
  }

  function assistantRoots() {
    var scope = getActiveMain() || document;
    var nodes = scope.querySelectorAll(ASSISTANT_SELECTOR);
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
    var scope = getActiveMain() || document;
    var stopVisible = !!scope.querySelector('button[data-testid="stop-button"]');
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
  // Extra Lite settings (all have explicit defaults; "重置" restores them).
  var SEND_KEY = 'mdliteSendCmdEnter';
  var REFRESH_FAB_KEY = 'mdliteShowRefreshFab';
  var CHIP_KEY = 'mdliteShowChip';
  var sendCmdEnter = storeGet(SEND_KEY, false) === true; // default OFF
  var showRefreshFab = storeGet(REFRESH_FAB_KEY, false) === true; // default OFF
  var showChip = storeGet(CHIP_KEY, true) !== false; // default ON
  var STEP_KEY = 'mdliteStepNav';
  var STEP_KEYS_KEY = 'mdliteStepKeys';
  var WORDS_KEY = 'mdliteWordCount';
  var COPYMD_KEY = 'mdliteCopyMd';
  var stepNav = storeGet(STEP_KEY, true) !== false; // default ON
  var stepKeys = storeGet(STEP_KEYS_KEY, true) !== false; // default ON (needs stepNav)
  var showWords = storeGet(WORDS_KEY, true) !== false; // default ON
  var copyMdOn = storeGet(COPYMD_KEY, true) !== false; // default ON
  var IS_MAC = /Mac|iPhone|iPad/i.test((navigator.platform || '') + ' ' + (navigator.userAgent || ''));
  var SEND_KEY_LABEL = IS_MAC ? '⌘+Enter' : 'Ctrl+Enter';

  // ---- styles ----
  // Page-width: mirror extension ChatGPTPageWidthController + 2026 ChatGPT CSS vars.
  // ChatGPT drives column width via per-element --thread-content-max-width (and
  // --thread-content-width for tables). Absolute px / none beats min(1200px,100%),
  // which collapses to the already-narrow containing block and looks like a no-op.
  var PAGE_WIDTH_SELECTORS = [
    '[class*="thread-content-max-width"]',
    '[class*="max-w-(--thread-content-max-width)"]',
    '[class*="max-w-[var(--thread-content-max-width)]"]',
    '.text-token-text-primary > div > div',
    'main [class*="xl:max-w-[48rem]"]',
    'main [class*="md:max-w-3xl"]',
    '.text-base.mx-auto',
  ];
  var PAGE_WIDTH_CSS_TARGETS = [
    '[class*="thread-content-max-width"]',
    '[class*="max-w-(--thread-content-max-width)"]',
    '[class*="max-w-[var(--thread-content-max-width)]"]',
    '.text-token-text-primary > div > div',
    'main [class*="xl:max-w-[48rem]"]',
    'main [class*="md:max-w-3xl"]',
    '.text-base.mx-auto',
    'form[data-type="unified-composer"]',
    'form:has(#prompt-textarea)',
    'form:has([data-testid="composer"])',
  ];
  var WIDTH_PX = { wide: 1200, full: null };
  var widthStyleEl = null;
  var widthFoundCache = false;

  function findWidthContainers() {
    var seen = [];
    var pushUnique = function (node) {
      if (!node || seen.indexOf(node) >= 0) return;
      // Prefer containers inside the active main when one exists.
      var active = getActiveMain();
      if (active && node instanceof HTMLElement && !active.contains(node) && node !== active) {
        // Allow form/composer nodes that sit outside main but still drive width.
        var tag = (node.tagName || '').toLowerCase();
        if (tag !== 'form' && !node.closest('form')) return;
      }
      seen.push(node);
    };
    var scope = getActiveMain() || document;
    for (var i = 0; i < PAGE_WIDTH_SELECTORS.length; i++) {
      try {
        scope.querySelectorAll(PAGE_WIDTH_SELECTORS[i]).forEach(pushUnique);
      } catch (_) { /* invalid selector in older engines — ignore */ }
    }
    // Composer often lives outside main — still scan document for form targets.
    try {
      document.querySelectorAll('form[data-type="unified-composer"], form:has(#prompt-textarea), form:has([data-testid="composer"])').forEach(pushUnique);
    } catch (_) { /* :has unsupported — ignore */ }
    // Prefer nodes that actually constrain width (pixel max-width or the CSS var class).
    var constraining = seen.filter(function (el) {
      var cls = typeof el.className === 'string' ? el.className : '';
      if (cls.indexOf('thread-content-max-width') >= 0) return true;
      var mw = window.getComputedStyle(el).maxWidth;
      var n = Number.parseFloat(mw);
      return mw && mw !== 'none' && mw !== '100%' && Number.isFinite(n) && n > 0 && n < window.innerWidth;
    });
    return constraining.length ? constraining : seen;
  }

  function hasWidthContainer() {
    var nodes = findWidthContainers();
    widthFoundCache = nodes.length > 0;
    return widthFoundCache;
  }

  function buildWidthCss(mode) {
    if (mode === 'normal') return '';
    var value = mode === 'full' ? 'none' : WIDTH_PX.wide + 'px';
    var varValue = mode === 'full' ? '100%' : WIDTH_PX.wide + 'px';
    var targets = PAGE_WIDTH_CSS_TARGETS.join(',');
    // Direct rules (no html[] prefix): same reliability as ChatGPTPageWidthController —
    // SPA can strip dataset flags; style text is what must keep working.
    var rules = [
      ':root,html,body,main{--thread-content-max-width:' + varValue + '!important;--thread-content-width:' + varValue + '!important}',
      targets + '{--thread-content-max-width:' + varValue + '!important;--thread-content-width:' + varValue + '!important;max-width:' + value + '!important}',
    ];
    if (mode === 'full') rules.push(targets + '{width:100%!important}');
    return rules.join('');
  }

  function ensureWidthStyle() {
    if (widthStyleEl && widthStyleEl.isConnected) return widthStyleEl;
    var existing = document.getElementById(NS + '-width-style');
    if (existing) {
      widthStyleEl = existing;
      return widthStyleEl;
    }
    widthStyleEl = document.createElement('style');
    widthStyleEl.id = NS + '-width-style';
    document.documentElement.appendChild(widthStyleEl);
    return widthStyleEl;
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
        Q + '-settings__card{background:#1e1e1e;color:#f2f2f2;border-color:rgba(255,255,255,.14)}',
        Q + '-settings button[aria-pressed="true"],' + Q + '-settings button[aria-checked="true"]{background:#f2f2f2;color:#111;border-color:#f2f2f2}',
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
      P + '-chip{gap:2px;padding:3px 6px}',
      P + '-chip button{border:0;background:transparent;color:inherit;font:inherit;cursor:pointer;padding:3px 6px;border-radius:999px}',
      P + '-chip button:hover{background:rgba(127,127,127,.18)}',
      P + '-chip button[hidden]{display:none!important}',
      P + '-fab button.step{padding:8px 10px}',
      P + '-panel__head small{opacity:.65;font-size:11px;white-space:nowrap}',
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
      P + '-fab button[hidden]{display:none!important}',
      P + '-settings[hidden]{display:none!important}',
      P + '-settings{position:fixed;inset:0;z-index:2147483003;display:flex;align-items:center;',
      'justify-content:center;background:rgba(0,0,0,.35);font:14px/1.45 system-ui,sans-serif}',
      P + '-settings__card{width:min(440px,94vw);max-height:90vh;overflow:auto;border-radius:14px;',
      'background:#fff;color:#111;border:1px solid rgba(0,0,0,.12);box-shadow:0 16px 48px rgba(0,0,0,.3);padding:14px 16px}',
      P + '-settings__head{display:flex;align-items:center;gap:8px;margin-bottom:6px}',
      P + '-settings__head strong{flex:1;font-size:15px}',
      P + '-settings__row{display:flex;align-items:center;gap:10px;padding:9px 0;border-top:1px solid rgba(127,127,127,.18)}',
      P + '-settings__txt{flex:1;min-width:0}',
      P + '-settings__txt small{display:block;opacity:.65;font-size:11px;margin-top:2px}',
      P + '-settings button{border:1px solid rgba(127,127,127,.35);background:transparent;color:inherit;',
      'border-radius:8px;padding:5px 10px;cursor:pointer;font:12px/1.2 system-ui,sans-serif}',
      P + '-settings button[aria-pressed="true"],' + P + '-settings button[aria-checked="true"]{background:#111;color:#fff;border-color:#111}',
      P + '-settings__seg{display:inline-flex;gap:4px}',
      P + '-settings__foot{display:flex;align-items:center;gap:8px;padding-top:10px;border-top:1px solid rgba(127,127,127,.18)}',
      P + '-settings__foot small{flex:1;opacity:.6;font-size:11px}',
      P + '-toast{position:fixed;left:50%;bottom:24px;transform:translateX(-50%);z-index:2147483002;',
      'display:flex;gap:10px;align-items:center;max-width:min(520px,92vw);padding:10px 14px;',
      'border-radius:10px;background:#111;color:#fff;font:13px/1.3 system-ui,sans-serif;',
      'box-shadow:0 8px 24px rgba(0,0,0,.25)}',
      P + '-toast button{border:0;border-radius:6px;padding:4px 8px;cursor:pointer;',
      'background:#fff;color:#111;font:12px/1.2 system-ui,sans-serif}',
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
    } else {
      html.setAttribute('data-mdlite-width', pageWidth);
    }
    var style = ensureWidthStyle();
    style.textContent = buildWidthCss(pageWidth);
    hasWidthContainer();
  }
  function setPageWidth(mode, silent) {
    pageWidth = normWidth(mode);
    storeSet(WIDTH_KEY, pageWidth);
    applyPageWidth();
    syncFab();
    syncMenu();
    syncSettings();
    scheduleChip();
    if (!silent) {
      var note = pageWidth === 'normal' ? '' : (widthFoundCache ? '' : '（未找到宽度容器，若没变宽请截图）');
      toast('页面宽度：' + WIDTH_LABEL[pageWidth] + note, { durationMs: 1800 });
    }
  }

  // ---- reader panel ----
  var panel = null;
  var panelBody = null;
  var rail = null;
  var railList = null;
  var pinBtn = null;
  var readerWidthBtn = null;
  var readerCountEl = null;
  var readerCopyBtn = null;
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
    readerCountEl = document.createElement('small');
    readerCopyBtn = document.createElement('button');
    readerCopyBtn.type = 'button';
    readerCopyBtn.className = NS + '-pin';
    readerCopyBtn.textContent = '复制 MD';
    readerCopyBtn.title = '复制这条回复的 Markdown';
    readerCopyBtn.addEventListener('click', function () {
      if (currentRoot) copyMarkdownOf(currentRoot);
    });
    head.appendChild(title);
    head.appendChild(readerCountEl);
    head.appendChild(readerCopyBtn);
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
    syncSettings();
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
    syncReaderExtras();
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


  // ===================================================================
  // Message step navigation / CJK word count / copy Markdown (Lite)
  // All DOM discovery is scoped to the active page main via assistantRoots().
  // ===================================================================

  // ---- word count (CJK aware; code blocks, math and UI chrome excluded) ----
  var CJK_RE = new RegExp('[\\u3400-\\u4dbf\\u4e00-\\u9fff\\uf900-\\ufaff\\u3040-\\u30ff\\u{20000}-\\u{2fa1f}]', 'gu');
  var WORD_RE = /[A-Za-z0-9\u00C0-\u024F\uac00-\ud7af]+(?:['’\-.][A-Za-z0-9\u00C0-\u024F\uac00-\ud7af]+)*/g;
  var SKIP_COUNT_SEL = 'pre, .katex, .katex-display, button, svg, script, style, [class*="' + NS + '-"]';

  function markdownRoots(root) {
    var all = root.querySelectorAll('.markdown');
    var out = [];
    for (var i = 0; i < all.length; i++) {
      var m = all[i];
      if (m.parentElement && m.parentElement.closest('.markdown') && root.contains(m.parentElement.closest('.markdown'))) continue;
      out.push(m);
    }
    if (out.length) return out;
    return [root.querySelector(CONTENT_SELECTOR) || root];
  }

  function countText(text) {
    var cjk = (text.match(CJK_RE) || []).length;
    var words = (text.replace(CJK_RE, ' ').match(WORD_RE) || []).length;
    return { cjk: cjk, words: words, total: cjk + words };
  }

  var COUNT_SEP = { p: 1, div: 1, li: 1, tr: 1, td: 1, th: 1, br: 1, h1: 1, h2: 1, h3: 1, h4: 1, h5: 1, h6: 1, ul: 1, ol: 1, table: 1, blockquote: 1, section: 1, article: 1, hr: 1 };

  // Collect countable text; block/cell boundaries become spaces, inline tags do not
  // (so "foo<b>bar</b>" stays one word). Code blocks, math and UI chrome are skipped.
  function collectCountText(node, out) {
    if (node.nodeType === 3) {
      out.push(node.nodeValue);
      return;
    }
    if (node.nodeType !== 1) return;
    if (node.matches(SKIP_COUNT_SEL)) return;
    var sep = COUNT_SEP[node.tagName.toLowerCase()] ? ' ' : '';
    if (sep) out.push(sep);
    for (var c = node.firstChild; c; c = c.nextSibling) collectCountText(c, out);
    if (sep) out.push(sep);
  }

  function countWordsOf(root) {
    var cjk = 0;
    var words = 0;
    var roots = markdownRoots(root);
    for (var r = 0; r < roots.length; r++) {
      var parts = [];
      collectCountText(roots[r], parts);
      var c = countText(parts.join(''));
      cjk += c.cjk;
      words += c.words;
    }
    return { cjk: cjk, words: words, total: cjk + words };
  }

  var countCache = { root: null, at: 0, val: null };
  function cachedCount(root) {
    var now = Date.now();
    if (countCache.root === root && now - countCache.at < 1000) return countCache.val;
    countCache = { root: root, at: now, val: countWordsOf(root) };
    return countCache.val;
  }
  function fmtCount(c) {
    return c.total.toLocaleString('en-US') + ' 字';
  }
  function countTitle(c) {
    return '中日文 ' + c.cjk + ' 字 + 英文 ' + c.words + ' 词（不含代码块与公式）';
  }

  function syncChipLabel(round) {
    if (!chipMain) return;
    var label = '📖 阅读器';
    var title = 'MarkDone Lite：在侧栏阅读这条回复（含大纲）';
    if (showWords && round && round.root) {
      var c = cachedCount(round.root);
      label += ' · ' + fmtCount(c);
      title += '\n' + countTitle(c);
    }
    if (chipMain.textContent !== label) chipMain.textContent = label;
    chipMain.title = title;
    if (chipCopy) chipCopy.hidden = !copyMdOn;
  }

  function syncReaderExtras() {
    if (readerCountEl) {
      if (showWords && currentRoot && currentRoot.isConnected) {
        var c = countWordsOf(currentRoot);
        readerCountEl.textContent = fmtCount(c);
        readerCountEl.title = countTitle(c);
        readerCountEl.hidden = false;
      } else {
        readerCountEl.hidden = true;
      }
    }
    if (readerCopyBtn) readerCopyBtn.hidden = !copyMdOn;
  }

  // ---- HTML -> Markdown (own converter for ChatGPT's rendered message DOM) ----
  var BLOCK_TAGS = {
    p: 1, div: 1, section: 1, article: 1, header: 1, footer: 1, main: 1, aside: 1, figure: 1, figcaption: 1,
    h1: 1, h2: 1, h3: 1, h4: 1, h5: 1, h6: 1, ul: 1, ol: 1, li: 1, pre: 1, blockquote: 1, table: 1, hr: 1,
    details: 1, summary: 1, dl: 1, dt: 1, dd: 1,
  };
  var SKIP_TAGS = { button: 1, svg: 1, script: 1, style: 1, noscript: 1, template: 1, textarea: 1, input: 1, select: 1 };

  function texOf(el) {
    var ann = el.querySelector('annotation[encoding="application/x-tex"]');
    return ann ? (ann.textContent || '').trim() : '';
  }

  function isSkipped(el) {
    var tag = el.tagName.toLowerCase();
    if (SKIP_TAGS[tag]) return true;
    var cls = typeof el.className === 'string' ? el.className : '';
    if (cls.indexOf(NS + '-') >= 0) return true;
    if (el.getAttribute('aria-hidden') === 'true' && !el.classList.contains('katex')) return true;
    return false;
  }

  function codeLang(pre) {
    var codeEl = pre.querySelector('code');
    var holders = [codeEl, pre.querySelector('[class*="language-"]'), pre];
    for (var i = 0; i < holders.length; i++) {
      var h = holders[i];
      if (!h) continue;
      var m = /(?:^|\s)language-([\w+#.\-]+)/.exec(typeof h.className === 'string' ? h.className : '');
      if (m && m[1] !== 'plaintext' && m[1] !== 'text') return m[1];
    }
    // ChatGPT header strip: a short single-word label before the code body.
    var cand = pre.querySelectorAll('div, span');
    for (var j = 0; j < cand.length && j < 6; j++) {
      var el = cand[j];
      if (el.querySelector('code, .cm-content, pre')) continue;
      var t = '';
      for (var k = 0; k < el.childNodes.length; k++) {
        if (el.childNodes[k].nodeType === 3) t += el.childNodes[k].nodeValue;
      }
      t = t.trim();
      if (t && t.length <= 24 && /^[A-Za-z][\w+#.\-]*$/.test(t)) return t.toLowerCase();
    }
    return '';
  }

  function codeText(pre) {
    var lines = pre.querySelectorAll('.cm-line');
    if (lines.length) {
      var out = [];
      for (var i = 0; i < lines.length; i++) out.push(lines[i].textContent || '');
      return out.join('\n');
    }
    var codeEl = pre.querySelector('code');
    var txt = (codeEl || pre).textContent || '';
    return txt;
  }

  function fenceFor(code) {
    var fence = '```';
    while (code.indexOf(fence) >= 0) fence += '`';
    return fence;
  }

  function inlineMd(node) {
    if (node.nodeType === 3) return (node.nodeValue || '').replace(/\s+/g, ' ');
    if (node.nodeType !== 1) return '';
    if (isSkipped(node)) return '';
    var tag = node.tagName.toLowerCase();
    var cls = typeof node.className === 'string' ? node.className : '';
    if (cls.indexOf('katex-display') >= 0) {
      var td = texOf(node);
      return td ? '\n\n$$\n' + td + '\n$$\n\n' : '';
    }
    if (node.classList.contains('katex')) {
      var ti = texOf(node);
      return ti ? '$' + ti + '$' : (node.textContent || '');
    }
    if (tag === 'br') return '  \n';
    if (tag === 'code') {
      var ct = node.textContent || '';
      var tick = '`';
      while (ct.indexOf(tick) >= 0) tick += '`';
      var pad = ct.charAt(0) === '`' || ct.charAt(ct.length - 1) === '`' ? ' ' : '';
      return tick + pad + ct + pad + tick;
    }
    var inner = inlineChildren(node);
    if (tag === 'strong' || tag === 'b') return wrapInline(inner, '**');
    if (tag === 'em' || tag === 'i') return wrapInline(inner, '*');
    if (tag === 'del' || tag === 's' || tag === 'strike') return wrapInline(inner, '~~');
    if (tag === 'a') {
      var href = node.getAttribute('href') || '';
      var txt = inner.trim();
      if (!href || href.charAt(0) === '#' && !txt) return inner;
      return '[' + (txt || href) + '](' + href.replace(/\)/g, '%29').replace(/\s/g, '%20') + ')';
    }
    if (tag === 'img') {
      var src = node.getAttribute('src') || '';
      return src ? '![' + (node.getAttribute('alt') || '') + '](' + src + ')' : '';
    }
    if (tag === 'sup') return '<sup>' + inner + '</sup>';
    if (tag === 'sub') return '<sub>' + inner + '</sub>';
    return inner;
  }
  function wrapInline(inner, mark) {
    var t = inner.replace(/^(\s*)([\s\S]*?)(\s*)$/, function (_, a, b, c) {
      return b ? a + mark + b + mark + c : a + c;
    });
    return t;
  }
  function inlineChildren(el) {
    var out = '';
    for (var i = 0; i < el.childNodes.length; i++) out += inlineMd(el.childNodes[i]);
    return out;
  }

  function isBlockEl(n) {
    if (n.nodeType !== 1) return false;
    var tag = n.tagName.toLowerCase();
    if (BLOCK_TAGS[tag]) return true;
    return !!(n.classList && n.classList.contains('katex-display'));
  }

  // Convert the children of a container into an array of block strings.
  function blocksMd(parent) {
    var blocks = [];
    var buf = '';
    function flush() {
      var t = buf.replace(/^[ \t]+/, '').replace(/[ \t]+$/g, '');
      buf = '';
      if (t.replace(/\s+/g, '') === '') return;
      blocks.push(t.replace(/^\n+|\n+$/g, ''));
    }
    for (var i = 0; i < parent.childNodes.length; i++) {
      var n = parent.childNodes[i];
      if (n.nodeType === 1 && isSkipped(n)) continue;
      if (isBlockEl(n)) {
        flush();
        var b = blockMd(n);
        for (var k = 0; k < b.length; k++) blocks.push(b[k]);
      } else {
        buf += inlineMd(n);
      }
    }
    flush();
    return blocks;
  }

  function indentLines(text, pad) {
    return text.split('\n').map(function (l, i) { return i === 0 || l === '' ? l : pad + l; }).join('\n');
  }

  function listMd(list, depthOrdered) {
    var ordered = list.tagName.toLowerCase() === 'ol';
    var start = ordered ? parseInt(list.getAttribute('start') || '1', 10) : 1;
    if (!Number.isFinite(start)) start = 1;
    var items = [];
    var idx = 0;
    for (var i = 0; i < list.children.length; i++) {
      var li = list.children[i];
      if (li.tagName.toLowerCase() !== 'li' || isSkipped(li)) continue;
      var marker = ordered ? (start + idx) + '. ' : '- ';
      idx++;
      var parts = blocksMd(li);
      var body = '';
      for (var j = 0; j < parts.length; j++) {
        if (j > 0) {
          var prevIsList = /^(?:[-*] |\d+\. )/.test(parts[j]);
          body += prevIsList || /^(?:[-*] |\d+\. )/.test(parts[j - 1]) ? '\n' : '\n\n';
        }
        body += parts[j];
      }
      var pad = new Array(marker.length + 1).join(' ');
      items.push(marker + indentLines(body, pad));
    }
    return items.join('\n');
  }

  function tableMd(table) {
    var rows = table.querySelectorAll('tr');
    var data = [];
    var aligns = [];
    for (var i = 0; i < rows.length; i++) {
      if (rows[i].closest('table') !== table) continue;
      var cells = rows[i].children;
      var row = [];
      for (var j = 0; j < cells.length; j++) {
        var c = cells[j];
        var tag = c.tagName.toLowerCase();
        if (tag !== 'th' && tag !== 'td') continue;
        var txt = inlineChildren(c).replace(/\s*\n\s*/g, '<br>').replace(/\|/g, '\\|').replace(/\s+/g, ' ').trim();
        row.push(txt);
        if (data.length === 0) {
          var al = (c.getAttribute('align') || (c.style && c.style.textAlign) || '').toLowerCase();
          aligns.push(al === 'center' ? ':---:' : al === 'right' ? '---:' : al === 'left' ? ':---' : '---');
        }
      }
      if (row.length) data.push(row);
    }
    if (!data.length) return '';
    var cols = 0;
    data.forEach(function (r) { if (r.length > cols) cols = r.length; });
    while (aligns.length < cols) aligns.push('---');
    var lines = [];
    data.forEach(function (r, idx) {
      while (r.length < cols) r.push('');
      lines.push('| ' + r.join(' | ') + ' |');
      if (idx === 0) lines.push('| ' + aligns.join(' | ') + ' |');
    });
    return lines.join('\n');
  }

  function blockMd(el) {
    var tag = el.tagName.toLowerCase();
    if (/^h[1-6]$/.test(tag)) {
      var t = inlineChildren(el).replace(/\s+/g, ' ').trim();
      return t ? ['#'.repeat(parseInt(tag.charAt(1), 10)) + ' ' + t] : [];
    }
    if (tag === 'p' || tag === 'dt' || tag === 'summary' || tag === 'figcaption') {
      var pt = inlineChildren(el).replace(/^[ \t]+|[ \t]+$/g, '').replace(/^\n+|\n+$/g, '');
      return pt.replace(/\s+/g, '') ? [pt] : [];
    }
    if (tag === 'ul' || tag === 'ol') {
      var lt = listMd(el);
      return lt ? [lt] : [];
    }
    if (tag === 'li') return blocksMd(el); // stray li outside a list
    if (tag === 'pre') {
      var code = codeText(el).replace(/\n$/, '');
      var fence = fenceFor(code);
      return [fence + codeLang(el) + '\n' + code + '\n' + fence];
    }
    if (tag === 'blockquote') {
      var inner = blocksMd(el).join('\n\n');
      return inner ? [inner.split('\n').map(function (l) { return l ? '> ' + l : '>'; }).join('\n')] : [];
    }
    if (tag === 'table') {
      var tt = tableMd(el);
      return tt ? [tt] : [];
    }
    if (tag === 'hr') return ['---'];
    if (el.classList.contains('katex-display')) {
      var tex = texOf(el);
      return tex ? ['$$\n' + tex + '\n$$'] : [];
    }
    // generic container: div/section/...
    return blocksMd(el);
  }

  function htmlToMarkdown(rootEl) {
    var md = blocksMd(rootEl).join('\n\n');
    return md.replace(/\n{3,}/g, '\n\n').trim() + '\n';
  }

  function messageMarkdown(root) {
    var roots = markdownRoots(root);
    var parts = [];
    for (var i = 0; i < roots.length; i++) {
      var md = htmlToMarkdown(roots[i]).trim();
      if (md) parts.push(md);
    }
    return parts.join('\n\n') + (parts.length ? '\n' : '');
  }

  function writeClipboard(text) {
    function legacy() {
      var ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.cssText = 'position:fixed;left:-9999px;top:0;opacity:0';
      document.documentElement.appendChild(ta);
      ta.select();
      var ok = false;
      try { ok = document.execCommand('copy'); } catch (_) { ok = false; }
      ta.remove();
      return ok;
    }
    try {
      if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
        return navigator.clipboard.writeText(text).then(function () { return true; }, function () { return legacy(); });
      }
    } catch (_) { /* fall through */ }
    return Promise.resolve(legacy());
  }

  function copyMarkdownOf(root) {
    closeMenu();
    if (!root || !root.isConnected) {
      toast('这条回复已不在页面里，请重新选择。', { durationMs: 3000 });
      return Promise.resolve(false);
    }
    var md = messageMarkdown(root);
    if (!md.trim()) {
      toast('这条回复里没找到可复制的内容。', { durationMs: 3000 });
      return Promise.resolve(false);
    }
    return writeClipboard(md).then(function (ok) {
      toast(ok ? '已复制 Markdown（' + md.length.toLocaleString('en-US') + ' 字符）' : '复制失败：浏览器拒绝写入剪贴板（可先点一下页面再试）。', { durationMs: ok ? 2200 : 5000 });
      return ok;
    });
  }

  function copyCurrentMarkdown() {
    var target = null;
    if (panel && !panel.hidden && currentRoot && currentRoot.isConnected) target = currentRoot;
    if (!target && bound && bound.root && bound.root.isConnected) target = bound.root;
    if (!target) {
      var p = resolvePrimary(collectRounds());
      if (p) target = p.root;
    }
    if (!target) {
      var all = assistantRoots();
      if (all.length) target = all[all.length - 1];
    }
    if (!target) {
      toast('没在当前页面找到助手回复。', { durationMs: 3000 });
      return Promise.resolve(false);
    }
    return copyMarkdownOf(target);
  }

  // ---- message step navigation ----
  function scrollContainerOf(el) {
    var n = el.parentElement;
    while (n && n !== document.documentElement) {
      var oy = '';
      try { oy = window.getComputedStyle(n).overflowY; } catch (_) { oy = ''; }
      if ((oy === 'auto' || oy === 'scroll') && n.scrollHeight > n.clientHeight + 1) return n;
      n = n.parentElement;
    }
    return null;
  }

  function scrollToMessage(root) {
    var sc = scrollContainerOf(root);
    var topPad = 72; // clear ChatGPT's sticky header
    if (sc) {
      var delta = root.getBoundingClientRect().top - sc.getBoundingClientRect().top - topPad;
      try { sc.scrollTo({ top: sc.scrollTop + delta, behavior: 'smooth' }); return; } catch (_) { sc.scrollTop += delta; return; }
    }
    try { root.scrollIntoView({ block: 'start', behavior: 'smooth' }); } catch (_) { root.scrollIntoView(true); }
  }

  function stepTargets() {
    var roots = assistantRoots();
    var out = [];
    for (var i = 0; i < roots.length; i++) {
      var r = roots[i].getBoundingClientRect();
      if (r.height <= 0 && r.width <= 0) continue;
      out.push({ root: roots[i], top: r.top, bottom: r.bottom });
    }
    return out;
  }

  function stepMessage(dir) {
    var list = stepTargets();
    if (!list.length) {
      toast('没在当前页面找到助手回复。', { durationMs: 2500 });
      return false;
    }
    // Anchor = message at the reading line (35% down); fall back to first message below it.
    var vh = window.innerHeight || 1;
    var lineY = Math.round(vh * REF_RATIO);
    var idx = -1;
    var primary = resolvePrimary(collectRounds());
    if (primary) {
      for (var i = 0; i < list.length; i++) if (list[i].root === primary.root) { idx = i; break; }
    }
    if (idx < 0) {
      for (var j = 0; j < list.length; j++) if (list[j].bottom > lineY) { idx = j; break; }
      if (idx < 0) idx = list.length - 1;
    }
    var target = null;
    if (dir < 0) {
      // Mid-way through a tall message: first jump to its own start.
      target = list[idx].top < -24 ? list[idx] : list[idx - 1];
    } else {
      target = list[idx].top > lineY + 8 && idx === 0 ? list[idx] : list[idx + 1];
    }
    if (!target) {
      toast(dir < 0 ? '已经是第一条回复' : '已经是最后一条回复', { durationMs: 1400 });
      return false;
    }
    scrollToMessage(target.root);
    if (panel && !panel.hidden) openReader(target.root);
    closeMenu();
    return true;
  }

  function isTypingTarget(t) {
    if (!(t instanceof Element)) return false;
    if (t.closest('input, textarea, select, [contenteditable=""], [contenteditable="true"], [contenteditable="plaintext-only"]')) return true;
    if (t.closest('[role="textbox"], [role="combobox"], [role="searchbox"], [role="slider"], [role="spinbutton"], [role="listbox"], [role="menu"], [role="dialog"]')) return true;
    return false;
  }

  function onStepKeydown(e) {
    if (!stepNav || !stepKeys) return;
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) return;
    if (e.isComposing || e.keyCode === 229 || imeComposing) return;
    if (isTypingTarget(e.target) || isTypingTarget(document.activeElement)) return;
    if (settingsEl && !settingsEl.hidden) return;
    var sel = window.getSelection && window.getSelection();
    if (sel && !sel.isCollapsed && String(sel).length > 0) return; // don't fight text-selection extension
    if (!stepTargets().length) return;
    e.preventDefault();
    stepMessage(e.key === 'ArrowLeft' ? -1 : 1);
  }

  function setStepNav(v) {
    stepNav = !!v;
    storeSet(STEP_KEY, stepNav);
    syncFab();
    syncMenu();
    syncSettings();
  }
  function setStepKeys(v) {
    stepKeys = !!v;
    storeSet(STEP_KEYS_KEY, stepKeys);
    syncSettings();
  }
  function setShowWords(v) {
    showWords = !!v;
    storeSet(WORDS_KEY, showWords);
    countCache = { root: null, at: 0, val: null };
    syncReaderExtras();
    scheduleChip();
    syncSettings();
  }
  function setCopyMd(v) {
    copyMdOn = !!v;
    storeSet(COPYMD_KEY, copyMdOn);
    syncReaderExtras();
    if (chipCopy) chipCopy.hidden = !copyMdOn;
    syncMenu();
    syncSettings();
  }

  // ---- viewport chip ----
  var chip = null;
  var pending = null;
  var pendingSince = 0;
  var bound = null;
  var raf = 0;
  var chipMain = null;
  var chipCopy = null;

  function ensureChip() {
    if (chip) {
      if (!chip.isConnected) document.documentElement.appendChild(chip);
      return chip;
    }
    chip = document.createElement('div');
    chip.className = NS + '-chip';
    chip.hidden = true;
    chipMain = document.createElement('button');
    chipMain.type = 'button';
    chipMain.className = NS + '-chip__main';
    chipMain.textContent = '📖 阅读器';
    chipMain.title = 'MarkDone Lite：在侧栏阅读这条回复（含大纲）';
    chipMain.addEventListener('click', function () {
      if (!bound || !bound.root) return;
      openReader(bound.root);
    });
    chipCopy = document.createElement('button');
    chipCopy.type = 'button';
    chipCopy.className = NS + '-chip__copy';
    chipCopy.textContent = '📋 MD';
    chipCopy.title = '复制这条回复的 Markdown';
    chipCopy.addEventListener('click', function (e) {
      e.stopPropagation();
      if (!bound || !bound.root) return;
      copyMarkdownOf(bound.root);
    });
    chip.appendChild(chipMain);
    chip.appendChild(chipCopy);
    document.documentElement.appendChild(chip);
    return chip;
  }

  function placeChip(round, fixed) {
    ensureChip();
    if (!showChip || !round || (panel && !panel.hidden)) {
      chip.hidden = true;
      return;
    }
    chip.hidden = false;
    syncChipLabel(round);
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
    // Lite: rescan assistants inside the active main only; no location.assign.
    closeMenu();
    invalidateActiveMain();
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
  var fabRefreshBtn = null;
  var fabPrevBtn = null;
  var fabNextBtn = null;
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
    fabRefreshBtn = mkBtn('🔄 软刷新', '重扫已挂载消息，不整页刷新', softRefresh, 'secondary');
    fabRefreshBtn.setAttribute('data-role', 'refresh');
    var more = mkBtn('Lite ☰', 'MarkDone Lite 菜单', toggleMenu);
    more.setAttribute('data-role', 'menu');
    fabPrevBtn = mkBtn('▲', '上一条助手回复（←）', function () { stepMessage(-1); }, 'secondary step');
    fabPrevBtn.setAttribute('data-role', 'step-prev');
    fabPrevBtn.setAttribute('aria-label', '上一条助手回复');
    fabNextBtn = mkBtn('▼', '下一条助手回复（→）', function () { stepMessage(1); }, 'secondary step');
    fabNextBtn.setAttribute('data-role', 'step-next');
    fabNextBtn.setAttribute('aria-label', '下一条助手回复');
    fab.appendChild(fabPrevBtn);
    fab.appendChild(fabNextBtn);
    fab.appendChild(reader);
    fab.appendChild(fabWidthBtn);
    fab.appendChild(fabRefreshBtn);
    fab.appendChild(more);
    document.documentElement.appendChild(fab);
    syncFab();
  }

  function syncFab() {
    if (!fabWidthBtn) return;
    fabWidthBtn.textContent = '↔ 宽度·' + WIDTH_LABEL[pageWidth];
    fabWidthBtn.setAttribute('aria-label', '页面宽度：' + WIDTH_LABEL[pageWidth]);
    if (fabRefreshBtn) fabRefreshBtn.hidden = !showRefreshFab;
    if (fabPrevBtn) fabPrevBtn.hidden = !stepNav;
    if (fabNextBtn) fabNextBtn.hidden = !stepNav;
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
    if (copyMdOn) {
      var cp = mkBtn('📋 复制当前回复 Markdown', '复制视口内主读回复（或阅读器里这条）的 Markdown', copyCurrentMarkdown);
      cp.setAttribute('data-role', 'copy-md');
      menu.appendChild(cp);
    }
    if (stepNav) {
      var srow = document.createElement('div');
      srow.className = NS + '-menu__row';
      var slab = document.createElement('span');
      slab.className = NS + '-menu__label';
      slab.textContent = '消息步进';
      srow.appendChild(slab);
      var sp = mkBtn('▲ 上一条', '上一条助手回复', function () { stepMessage(-1); });
      sp.setAttribute('data-role', 'menu-step-prev');
      var sn = mkBtn('▼ 下一条', '下一条助手回复', function () { stepMessage(1); });
      sn.setAttribute('data-role', 'menu-step-next');
      srow.appendChild(sp);
      srow.appendChild(sn);
      menu.appendChild(srow);
    }
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
    var send = mkBtn(
      (sendCmdEnter ? '⌨ ' + SEND_KEY_LABEL + ' 发送：开（Enter 换行）' : '⌨ ' + SEND_KEY_LABEL + ' 发送：关'),
      'ChatGPT 输入框：Enter 换行，' + SEND_KEY_LABEL + ' 发送；Shift+Enter 仍是换行',
      function () {
        setSendCmdEnter(!sendCmdEnter);
      },
    );
    send.setAttribute('data-role', 'send-toggle');
    send.setAttribute('role', 'menuitemcheckbox');
    send.setAttribute('aria-checked', sendCmdEnter ? 'true' : 'false');
    menu.appendChild(send);
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
    var gear = mkBtn('⚙ 设置…', '打开 MarkDone Lite 设置面板', openSettings);
    gear.setAttribute('data-role', 'settings');
    menu.appendChild(gear);
    menu.appendChild(document.createElement('hr'));
    var info = document.createElement('small');
    var widthOk = hasWidthContainer();
    var activeMain = getActiveMain();
    info.textContent =
      'Lite v' + VERSION + ' · 检测到 ' + assistantRoots().length + ' 条助手回复' +
      (activeMain ? ' · 已锁定当前页 main' : ' · 未找到 active main') +
      (widthOk ? ' · 宽度容器已命中' : ' · 未找到宽度容器') +
      ' · 宽度=' + WIDTH_LABEL[pageWidth] +
      ' · 发送键=' + (sendCmdEnter ? SEND_KEY_LABEL : '默认');
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


  // ---- Cmd/Ctrl+Enter to send (Enter = newline) ----
  // Own implementation of the same idea as the extension's ChatGPT input enhancement
  // (setting enterKeyNewline): Enter -> newline, Cmd/Ctrl+Enter -> send, Shift+Enter untouched.
  // One capture-phase listener on window => survives SPA nav / composer re-render.
  var COMPOSER_SELECTOR = '#prompt-textarea, form[data-type="unified-composer"] [contenteditable="true"], form[data-type="unified-composer"] textarea';
  var SEND_BTN_SELECTOR = [
    'button[data-testid="send-button"]',
    'button[data-testid="composer-submit-button"]',
    'button[aria-label="Send prompt"]',
    'button[aria-label="发送提示"]',
    'button[aria-label="Send message"]',
  ].join(',');
  var imeComposing = false;
  var imeEndedAt = 0;
  var synthetic = false; // true while we re-dispatch a key to the page's own handler

  function composerFromTarget(t) {
    if (!(t instanceof Element)) return null;
    var el = t.closest(COMPOSER_SELECTOR);
    if (el) return el;
    return null;
  }

  function isImeKey(e) {
    return e.isComposing || e.keyCode === 229 || imeComposing || Date.now() - imeEndedAt < 30;
  }

  function fireKey(target, type, init) {
    var ev = new KeyboardEvent(type, Object.assign({ key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true, cancelable: true, composed: true }, init));
    target.dispatchEvent(ev);
    return ev;
  }

  function insertNewline(target) {
    if (target instanceof HTMLTextAreaElement || target instanceof HTMLInputElement) {
      var st = target.selectionStart == null ? target.value.length : target.selectionStart;
      var en = target.selectionEnd == null ? st : target.selectionEnd;
      target.value = target.value.slice(0, st) + '\n' + target.value.slice(en);
      target.selectionStart = target.selectionEnd = st + 1;
      target.dispatchEvent(new Event('input', { bubbles: true }));
      return;
    }
    // ProseMirror: its own Shift+Enter binding inserts a hard break. If nothing handled
    // the synthetic key, fall back to the browser's native line-break command.
    synthetic = true;
    try {
      var ev = fireKey(target, 'keydown', { shiftKey: true });
      if (!ev.defaultPrevented) {
        var ok = false;
        try { ok = document.execCommand('insertLineBreak'); } catch (_) { /* ignore */ }
        if (!ok) { try { document.execCommand('insertParagraph'); } catch (_) { /* ignore */ } }
      }
      fireKey(target, 'keyup', { shiftKey: true });
    } finally {
      synthetic = false;
    }
  }

  function triggerSend(target) {
    var form = target.closest('form') || document;
    var btn = form.querySelector(SEND_BTN_SELECTOR);
    if (btn && !btn.disabled && btn.getAttribute('aria-disabled') !== 'true') {
      btn.click();
      return;
    }
    // No (enabled) send button found: replay a plain Enter into the page's own handler.
    synthetic = true;
    try {
      fireKey(target, 'keydown', {});
      fireKey(target, 'keyup', {});
    } finally {
      synthetic = false;
    }
  }

  function onSendKeydown(e) {
    if (!sendCmdEnter || synthetic || e.defaultPrevented) return;
    if (e.key !== 'Enter') return;
    if (e.shiftKey || e.altKey) return; // Shift+Enter: native newline; Alt: leave alone
    if (isImeKey(e)) return; // never touch IME confirm-Enter
    var target = composerFromTarget(e.target);
    if (!target) return;
    var mod = e.metaKey || e.ctrlKey;
    e.preventDefault();
    e.stopImmediatePropagation();
    if (mod) {
      if (e.repeat) return;
      triggerSend(target);
    } else {
      insertNewline(target);
    }
  }

  function setSendCmdEnter(v, silent) {
    sendCmdEnter = !!v;
    storeSet(SEND_KEY, sendCmdEnter);
    syncMenu();
    syncSettings();
    if (!silent) {
      toast(
        sendCmdEnter
          ? '已开启：' + SEND_KEY_LABEL + ' 发送，Enter 换行（仅 ChatGPT 输入框）'
          : '已关闭：恢复 ChatGPT 默认（Enter 发送）',
        { durationMs: 2600 },
      );
    }
  }

  function setShowRefreshFab(v) {
    showRefreshFab = !!v;
    storeSet(REFRESH_FAB_KEY, showRefreshFab);
    syncFab();
    syncSettings();
  }

  function setShowChip(v) {
    showChip = !!v;
    storeSet(CHIP_KEY, showChip);
    scheduleChip();
    syncSettings();
  }

  function setReaderWidth(mode) {
    readerWidth = normWidth(mode);
    storeSet(READER_WIDTH_KEY, readerWidth);
    syncReaderWidth();
    syncSettings();
  }

  function resetSettings() {
    setSendCmdEnter(false, true);
    setStepNav(true);
    setStepKeys(true);
    setShowWords(true);
    setCopyMd(true);
    setShowRefreshFab(false);
    setShowChip(true);
    setOutlinePinned(false, true);
    setPageWidth('normal', true);
    setReaderWidth('normal');
    toast('已恢复 Lite 默认设置', { durationMs: 2000 });
  }

  // ---- settings panel ----
  var settingsEl = null;

  function ensureSettings() {
    if (settingsEl) {
      if (!settingsEl.isConnected) document.documentElement.appendChild(settingsEl);
      return settingsEl;
    }
    settingsEl = document.createElement('div');
    settingsEl.className = NS + '-settings';
    settingsEl.id = NS + '-settings';
    settingsEl.hidden = true;
    settingsEl.setAttribute('role', 'dialog');
    settingsEl.setAttribute('aria-label', 'MarkDone Lite 设置');
    settingsEl.addEventListener('click', function (e) {
      if (e.target === settingsEl) closeSettings();
    });
    document.documentElement.appendChild(settingsEl);
    return settingsEl;
  }

  function settingRow(label, hint, control) {
    var row = document.createElement('div');
    row.className = NS + '-settings__row';
    var txt = document.createElement('div');
    txt.className = NS + '-settings__txt';
    txt.appendChild(document.createTextNode(label));
    if (hint) {
      var sm = document.createElement('small');
      sm.textContent = hint;
      txt.appendChild(sm);
    }
    row.appendChild(txt);
    row.appendChild(control);
    return row;
  }

  function toggleCtl(on, key, onChange) {
    var b = document.createElement('button');
    b.type = 'button';
    b.setAttribute('role', 'switch');
    b.setAttribute('data-setting', key);
    b.setAttribute('aria-checked', on ? 'true' : 'false');
    b.textContent = on ? '开' : '关';
    b.addEventListener('click', function (e) {
      e.stopPropagation();
      onChange(!on);
    });
    return b;
  }

  function segCtl(current, key, onPick) {
    var wrap = document.createElement('div');
    wrap.className = NS + '-settings__seg';
    WIDTH_ORDER.forEach(function (m) {
      var b = document.createElement('button');
      b.type = 'button';
      b.textContent = WIDTH_LABEL[m];
      b.setAttribute('data-setting', key);
      b.setAttribute('data-value', m);
      b.setAttribute('aria-pressed', current === m ? 'true' : 'false');
      b.addEventListener('click', function (e) {
        e.stopPropagation();
        onPick(m);
      });
      wrap.appendChild(b);
    });
    return wrap;
  }

  function renderSettings() {
    var el = ensureSettings();
    el.innerHTML = '';
    var card = document.createElement('div');
    card.className = NS + '-settings__card';
    var head = document.createElement('div');
    head.className = NS + '-settings__head';
    var title = document.createElement('strong');
    title.textContent = 'MarkDone Lite 设置';
    var close = document.createElement('button');
    close.type = 'button';
    close.textContent = '关闭';
    close.addEventListener('click', closeSettings);
    head.appendChild(title);
    head.appendChild(close);
    card.appendChild(head);
    card.appendChild(settingRow(SEND_KEY_LABEL + ' 发送', '开启后：Enter 换行，' + SEND_KEY_LABEL + ' 发送；Shift+Enter 仍是换行；输入法选字不受影响。默认关。',
      toggleCtl(sendCmdEnter, 'sendCmdEnter', function (v) { setSendCmdEnter(v); })));
    card.appendChild(settingRow('大纲钉住', '阅读器右侧大纲常显（关＝悬停展开）。',
      toggleCtl(outlinePinned, 'outlinePinned', function (v) { setOutlinePinned(v); })));
    card.appendChild(settingRow('默认页面宽度', '对话主栏宽度，会记住。',
      segCtl(pageWidth, 'pageWidth', function (m) { setPageWidth(m); })));
    card.appendChild(settingRow('阅读器宽度', '侧栏阅读器自身宽度。',
      segCtl(readerWidth, 'readerWidth', function (m) { setReaderWidth(m); })));
    card.appendChild(settingRow('消息步进', '右下角 ▲▼ 按钮：跳到上一条/下一条助手回复。',
      toggleCtl(stepNav, 'stepNav', function (v) { setStepNav(v); })));
    card.appendChild(settingRow('←/→ 键步进', '不在输入框里打字、没选中文字时，← 上一条、→ 下一条。需先开「消息步进」。',
      toggleCtl(stepKeys, 'stepKeys', function (v) { setStepKeys(v); })));
    card.appendChild(settingRow('字数统计', '阅读器小标签和侧栏顶部显示本条回复字数（中日文按字、英文按词，不含代码块和公式）。',
      toggleCtl(showWords, 'showWords', function (v) { setShowWords(v); })));
    card.appendChild(settingRow('复制 Markdown', '小标签上的「📋 MD」、侧栏顶部「复制 MD」、菜单项；保留代码围栏/语言、表格、列表、标题、链接。',
      toggleCtl(copyMdOn, 'copyMd', function (v) { setCopyMd(v); })));
    card.appendChild(settingRow('软刷新按钮', '在右下角显示「🔄 软刷新」；关＝只在 Lite ☰ 菜单里。',
      toggleCtl(showRefreshFab, 'showRefreshFab', function (v) { setShowRefreshFab(v); })));
    card.appendChild(settingRow('跟随阅读小标签', '滚动时跟在当前回复旁的「📖 阅读器」小标签；关＝只用右下按钮。',
      toggleCtl(showChip, 'showChip', function (v) { setShowChip(v); })));
    var foot = document.createElement('div');
    foot.className = NS + '-settings__foot';
    var small = document.createElement('small');
    small.textContent = 'Lite v' + VERSION;
    var reset = document.createElement('button');
    reset.type = 'button';
    reset.textContent = '恢复默认';
    reset.addEventListener('click', resetSettings);
    foot.appendChild(small);
    foot.appendChild(reset);
    card.appendChild(foot);
    el.appendChild(card);
  }

  function openSettings() {
    closeMenu();
    renderSettings();
    settingsEl.hidden = false;
  }
  function closeSettings() {
    if (settingsEl) settingsEl.hidden = true;
  }
  function syncSettings() {
    if (settingsEl && !settingsEl.hidden) renderSettings();
  }

  // ---- watchdog: survive SPA navigation / React re-render ----
  var lastHref = location.href;
  function ensureAll() {
    ensureStyle();
    ensureChip();
    ensureFab();
    if (menu && !menu.isConnected) document.documentElement.appendChild(menu);
    if (panel && !panel.isConnected) document.documentElement.appendChild(panel);
    if (settingsEl && !settingsEl.isConnected) document.documentElement.appendChild(settingsEl);
    applyPageWidth();
    if (location.href !== lastHref) {
      lastHref = location.href;
      invalidateActiveMain();
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
    window.addEventListener('keydown', onSendKeydown, true);
    window.addEventListener('keydown', onStepKeydown);
    window.addEventListener('compositionstart', function () { imeComposing = true; }, true);
    window.addEventListener('compositionend', function () { imeComposing = false; imeEndedAt = Date.now(); }, true);
    try {
      if (typeof GM_registerMenuCommand === 'function') {
        GM_registerMenuCommand('MarkDone Lite 设置', openSettings);
        GM_registerMenuCommand('MarkDone Lite：' + SEND_KEY_LABEL + ' 发送 开/关', function () { setSendCmdEnter(!sendCmdEnter); });
      }
    } catch (_) { /* ignore */ }
    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape') return;
      if (settingsEl && !settingsEl.hidden) { closeSettings(); return; }
      if (menu && !menu.hidden) closeMenu();
      else if (panel && !panel.hidden) {
        panel.hidden = true;
        scheduleChip();
      }
    });
    var moTimer = 0;
    var mo = new MutationObserver(function (mutations) {
      var surfaceChanged = false;
      for (var i = 0; i < mutations.length; i++) {
        var m = mutations[i];
        if (m.type === 'attributes' && m.attributeName === ACTIVE_PAGE_ATTR) {
          surfaceChanged = true;
          break;
        }
      }
      if (surfaceChanged) invalidateActiveMain();
      scheduleChip();
      if (moTimer) return;
      moTimer = setTimeout(function () {
        moTimer = 0;
        ensureAll();
      }, 250);
    });
    mo.observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: [ACTIVE_PAGE_ATTR],
    });
    setInterval(ensureAll, 1500);
    var am = getActiveMain();
    console.info(
      '[MarkDone Lite]', VERSION, 'booted;',
      assistantRoots().length, 'assistant nodes; width=' + pageWidth + ';',
      'activeMain=', am ? (am.id || am.tagName) : 'none', 'sendCmdEnter=' + sendCmdEnter,
    );
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();
