import { hasPartialRenderedInlineUnitSelection } from './atomicSelection';

const NON_HIGHLIGHTABLE_SELECTOR = [
    'pre',
    '[data-markdown-copy="code-block"]',
    '[data-markdown-copy="exclude"]',
    '[contenteditable]:not([contenteditable="false"])',
    'input',
    'textarea',
    '[role="textbox"]',
    'table',
    'img',
    'svg',
    'canvas',
    'iframe',
    'button',
    '[role="button"]',
    '[data-testid="chatgpt-citation"]',
].join(',');

function isBlocked(element: Element): boolean {
    return !element.matches('svg') || !element.closest('.katex, .katex-display');
}

/** Keep persistent highlights on ordinary rendered text, not embedded surfaces. */
export function isHighlightableTextSelection(range: Range, root: HTMLElement): boolean {
    if (range.collapsed || !root.contains(range.startContainer) || !root.contains(range.endContainer)) return false;
    const ancestor = range.commonAncestorContainer;
    const scope = ancestor instanceof HTMLElement ? ancestor : ancestor.parentElement;
    if (!scope) return false;
    const insideSpecial = scope.closest(NON_HIGHLIGHTABLE_SELECTOR);
    if (insideSpecial && root.contains(insideSpecial) && isBlocked(insideSpecial)) return false;
    for (const element of scope.querySelectorAll(NON_HIGHLIGHTABLE_SELECTOR)) {
        if (range.intersectsNode(element) && isBlocked(element)) return false;
    }
    return !hasPartialRenderedInlineUnitSelection(range, root);
}
