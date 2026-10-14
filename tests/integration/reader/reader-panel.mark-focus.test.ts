import { afterEach, describe, expect, it, vi } from 'vitest';
import { ReaderPanel } from '@/ui/content/reader/ReaderPanel';
import { highlightsClient } from '@/drivers/shared/clients/highlightsClient';

vi.mock('@/drivers/shared/clients/readerAnnotationsClient', () => ({
    readerAnnotationsClient: { list: vi.fn(async () => ({ ok: true, data: { entries: [] } })) },
    subscribeReaderAnnotationChanges: () => () => undefined,
}));
vi.mock('@/drivers/shared/clients/highlightsClient', () => ({ highlightsClient: {
    list: vi.fn(async () => []), subscribe: () => () => undefined,
} }));

afterEach(() => { vi.restoreAllMocks(); document.body.innerHTML = ''; });

describe('Reader mark focus from Library navigation', () => {
    it('focuses the exact stored highlight passage without opening an annotation editor', async () => {
        const sourceDocument = { platform: 'chatgpt' as const, conversationId: 'mark-focus' };
        vi.mocked(highlightsClient.list).mockResolvedValue([{ document: sourceDocument, highlight: {
            id: 'selected-highlight', itemId: 'reply', target: { assistantMessageId: 'assistant-1' },
            quoteText: 'Chosen passage', sourceMarkdown: 'Chosen passage', color: 'blue',
            selectors: { textQuote: { exact: 'Chosen passage', prefix: '', suffix: '' }, textPosition: { start: 0, end: 14 }, domRange: null, atomicRefs: [] },
            createdAt: 1, updatedAt: 1, revision: 1,
        } }]);
        const panel = new ReaderPanel();
        try {
            await panel.show([{ id: 'reply', userPrompt: 'Question', content: 'Chosen passage', meta: { assistantMessageId: 'assistant-1' } }], 0, 'light', { annotationDocument: sourceDocument });
            expect(await panel.focusAnnotation('highlight:selected-highlight', 'assistant-1')).toBe(true);
            expect(document.querySelector('#aimd-reader-panel-host')?.shadowRoot?.querySelector('.reader-comment-popover')).toBeNull();
            expect(await panel.focusAnnotation('highlight:selected-highlight', 'wrong-assistant')).toBe(false);
        } finally { panel.hide(); }
    });
});
