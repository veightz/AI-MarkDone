// @vitest-environment-options {"url":"https://chatgpt.com/c/example"}
import { afterEach, describe, expect, it } from 'vitest';
import { resolveRichContentMessageRoot } from '@/drivers/content/export/richContentAssets';

afterEach(() => { document.body.replaceChildren(); window.history.replaceState({}, '', '/c/example'); });

describe('rich content exact message root resolution', () => {
    it('reuses the adapter body selector for one exact native assistant identity', () => {
        document.body.innerHTML = '<main><div data-message-author-role="assistant" data-message-id="assistant-1"><div class="markdown prose">Body</div></div></main>';
        const body = document.querySelector('.markdown.prose');
        expect(resolveRichContentMessageRoot({ messageId: 'assistant-1', documentUrl: 'https://chatgpt.com/c/example#fragment' })).toBe(body);
        expect(resolveRichContentMessageRoot({ messageId: 'assistant-2' })).toBeNull();
        expect(resolveRichContentMessageRoot({ messageId: 'assistant-1', documentUrl: 'https://chatgpt.com/c/another' })).toBeNull();
    });

    it('allows message-query and hash navigation while requiring the same conversation pathname and exact assistant', () => {
        document.body.innerHTML = '<div data-message-author-role="assistant" data-message-id="assistant-1"><div class="markdown prose">One</div></div><div data-message-author-role="assistant" data-message-id="assistant-2"><div class="markdown prose">Two</div></div>';
        window.history.replaceState({}, '', '/c/example?message=assistant-2#heading');
        const expected = document.querySelector('[data-message-id="assistant-1"] .markdown.prose');
        expect(resolveRichContentMessageRoot({ messageId: 'assistant-1', documentUrl: 'https://chatgpt.com/c/example?message=assistant-1#old' })).toBe(expected);
        expect(resolveRichContentMessageRoot({ messageId: 'assistant-1', documentUrl: 'https://example.com/c/example' })).toBeNull();
    });

    it('rejects duplicate identities and conflicting native search carriers', () => {
        document.body.innerHTML = '<div data-message-author-role="assistant" data-message-id="assistant-1"><div class="markdown prose">One</div></div><div data-message-author-role="assistant" data-message-id="assistant-1"><div class="markdown prose">Two</div></div>';
        expect(resolveRichContentMessageRoot({ messageId: 'assistant-1' })).toBeNull();
        document.body.innerHTML = '<div data-message-author-role="assistant" data-message-id="assistant-1" data-chatgpt-search-message-ids="assistant-2"><div class="markdown prose">Conflicting</div></div>';
        expect(resolveRichContentMessageRoot({ messageId: 'assistant-1' })).toBeNull();
    });

    it('supports a unique native search unit without relying on a display position', () => {
        document.body.innerHTML = '<section data-chatgpt-search-unit-key="display-100:assistant" data-chatgpt-search-message-ids="assistant-1"><div data-markdown-text-style="assistant-message">Body</div></section>';
        expect(resolveRichContentMessageRoot({ messageId: 'assistant-1' })).toBe(document.querySelector('[data-markdown-text-style]'));
        expect(resolveRichContentMessageRoot({})).toBeNull();
    });
});
