/** Runs in the page context; keep this function independent of module state. */
export function readVisualPageIdentity() {
    let textLength = 0;
    const pending: Node[] = [document.body];
    while (pending.length > 0) {
        const node = pending.pop()!;
        if (node instanceof Element) {
            if (node.matches('style,script,template,[hidden],[aria-hidden="true"]')) continue;
            const style = getComputedStyle(node);
            if (style.display === 'none') continue;
            if (node.shadowRoot) pending.push(node.shadowRoot);
        } else if (node instanceof Text) {
            const parent = node.parentElement;
            const style = parent ? getComputedStyle(parent) : null;
            let hasBox = false;
            if (parent && style?.visibility !== 'hidden' && style?.visibility !== 'collapse') {
                for (const rect of parent.getClientRects()) {
                    if (rect.width > 0 && rect.height > 0) { hasBox = true; break; }
                }
            }
            if (hasBox) textLength += node.data.trim().length;
            continue;
        }
        for (const child of node.childNodes) pending.push(child);
    }
    // body.innerText omits open ShadowRoots in Chromium. Read rendered labels
    // across owned roots without letting hidden content or CSS mask a blank UI.
    return {
        title: document.title.trim(),
        textLength,
        viteOverlay: Boolean(document.querySelector('vite-error-overlay')),
    };
}
