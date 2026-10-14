export const CHATGPT_MESSAGE_CONTENT_IDENTITY_ATTRIBUTES = [
    'data-chatgpt-selection-message-id', 'data-dil-source-message-id', 'data-dil-message-id',
] as const;

const MESSAGE_OWNER = '[data-message-author-role], [data-chatgpt-search-unit-key]';
const CONTENT_ROOT = '[data-markdown-text-style="assistant-message"], .markdown.prose';
const EXCLUDED = 'blockquote, pre, code, button, a, [role="button"], [role="link"], [role="dialog"], [data-aimd-role], [data-d-component="blockquote"], [data-d-component="popover-trigger"], [data-testid$="-block-container"], [data-testid="chatgpt-chart-content-reference"], [data-testid="webpage-citation-pill"]';
const INNER_CARRIER = CHATGPT_MESSAGE_CONTENT_IDENTITY_ATTRIBUTES.map(attribute => `[${attribute}]`).join(',');

/** Message-owned carrier evidence only; component/quoted identities never promote or replace the outer message ID. */
export function isChatGPTMessageOwnedIdentityCarrier(carrier: Element, message: HTMLElement): boolean {
    if (carrier.closest(MESSAGE_OWNER) !== message) return false;
    const excluded = carrier.closest(EXCLUDED);
    if (excluded && message.contains(excluded)) return false;
    const roots = Array.from(message.querySelectorAll(CONTENT_ROOT)).filter(root => root.closest(MESSAGE_OWNER) === message);
    if (message.matches(CONTENT_ROOT)) roots.unshift(message);
    if (carrier.hasAttribute('data-chatgpt-selection-message-id')) return roots.some(root => carrier.contains(root));
    const body = roots.find(root => root.contains(carrier));
    if (!body) return false;
    let ancestor = carrier.parentElement;
    while (ancestor && ancestor !== body && ancestor !== message) {
        if (ancestor.hasAttribute('data-dil-message-id')) return false;
        if (carrier.hasAttribute('data-dil-source-message-id') && ancestor.hasAttribute('data-dil-source-message-id')) return false;
        if (ancestor.matches('p, li, table, figure, [data-d-component]')) return false;
        ancestor = ancestor.parentElement;
    }
    return true;
}

export function hasConsistentChatGPTMessageContentIdentity(message: HTMLElement): boolean {
    const outer = new Set(['data-message-id', 'data-chatgpt-search-message-ids'].flatMap(attribute => (
        message.getAttribute(attribute)?.trim().split(/\s+/).filter(Boolean) ?? []
    )));
    if (outer.size > 1) return false;
    const expected = [...outer][0];
    if (!expected) return true;
    const carriers = Array.from(message.querySelectorAll(INNER_CARRIER));
    if (message.matches(INNER_CARRIER)) carriers.unshift(message);
    return carriers.every(carrier => !isChatGPTMessageOwnedIdentityCarrier(carrier, message)
        || CHATGPT_MESSAGE_CONTENT_IDENTITY_ATTRIBUTES.every(attribute => {
            const value = carrier.getAttribute(attribute);
            return value === null || value.trim() === expected;
        }));
}
