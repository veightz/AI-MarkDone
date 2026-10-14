export const CHATGPT_ACTIVE_PAGE_ATTRIBUTE = 'data-app-shell-active-page';

export type ChatGPTActiveSurface = Readonly<{
    contentRoot: HTMLElement;
    pageRoot: ParentNode;
}>;

function mainElements(root: ParentNode): HTMLElement[] {
    if (root instanceof HTMLElement && root.matches('main')) return [root];
    return Array.from(root.querySelectorAll<HTMLElement>('main'));
}

/** Retained app-shell pages stay connected; only the unique active owner is current. */
export function resolveChatGPTActiveSurface(legacyRoot?: HTMLElement | null): ChatGPTActiveSurface | null {
    const owners = Array.from(document.querySelectorAll<HTMLElement>(`[${CHATGPT_ACTIVE_PAGE_ATTRIBUTE}]`));
    if (owners.length > 0) {
        const activeOwners = owners.filter(owner => owner.getAttribute(CHATGPT_ACTIVE_PAGE_ATTRIBUTE) === 'true');
        if (activeOwners.length !== 1) return null;
        const owner = activeOwners[0]!;
        if (owners.some(other => other !== owner && (owner.contains(other) || other.contains(owner)))) return null;
        const mains = mainElements(owner);
        return mains.length === 1 ? { contentRoot: mains[0]!, pageRoot: owner } : null;
    }

    // Legacy discovery may provide a narrower container than document.
    const scopedMains = legacyRoot ? mainElements(legacyRoot) : [];
    if (scopedMains.length > 1) return null;
    if (scopedMains.length === 1) return { contentRoot: scopedMains[0]!, pageRoot: document };
    const mains = mainElements(document);
    if (mains.length > 1) return null;
    if (mains.length === 1) return { contentRoot: mains[0]!, pageRoot: document };
    const fallback = legacyRoot ?? document.querySelector<HTMLElement>('#__next') ?? document.body;
    return fallback ? { contentRoot: fallback, pageRoot: document } : null;
}
