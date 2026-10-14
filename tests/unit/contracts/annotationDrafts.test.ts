import { describe, expect, it } from 'vitest';
import { annotationDraftKey, createAnnotationDraftIdentity } from '@/contracts/annotationDrafts';
import { createRequestId, isExtRequest, PROTOCOL_VERSION } from '@/contracts/protocol';

const document = { platform: 'chatgpt' as const, conversationId: 'one' };
const selection = { sourceMarkdown: 'Repeated quote', textQuote: { exact: 'Repeated quote', prefix: 'same prefix', suffix: 'same suffix' }, textPosition: { start: 10, end: 24 } };
describe('annotation draft identity and protocol', () => {
    it('uses verified conversation and message identity and disambiguates identical repeated quotes by position', () => {
        const first = createAnnotationDraftIdentity(document, 'assistant', selection)!;
        const repeated = createAnnotationDraftIdentity(document, 'assistant', { ...selection, textPosition: { start: 60, end: 74 } })!;
        expect(annotationDraftKey(first)).not.toBe(annotationDraftKey(repeated));
        expect(createAnnotationDraftIdentity(null, 'assistant', selection)).toBeNull();
        expect(createAnnotationDraftIdentity(document, null, selection)).toBeNull();
        expect(createAnnotationDraftIdentity({ ...document, conversationId: 'chatgpt:page:epoch' }, 'assistant', selection)).toBeNull();
        expect(annotationDraftKey(createAnnotationDraftIdentity({ ...document, conversationId: 'two' }, 'assistant', selection)!)).not.toBe(annotationDraftKey(first));
    });
    it('keeps editing drafts stable across changed display metadata and quote rendering', () => {
        const first = createAnnotationDraftIdentity(document, 'assistant', { ...selection, annotationId: 'note' })!;
        const next = createAnnotationDraftIdentity({ ...document, title: 'Renamed', lastKnownUrl: 'https://chatgpt.com/c/one?x=1' }, 'assistant', { ...selection, annotationId: 'note', sourceMarkdown: 'Updated quote' })!;
        expect(annotationDraftKey(first)).toBe(annotationDraftKey(next));
    });
    it('requires an explicit revision for mutations and refuses malformed recovery identities', () => {
        const identity = createAnnotationDraftIdentity(document, 'assistant', selection)!;
        const request = { v: PROTOCOL_VERSION, id: createRequestId(), type: 'annotations:draftWrite', payload: { identity, text: 'Draft', expectedRevision: 0 } };
        expect(isExtRequest(request)).toBe(true);
        expect(isExtRequest({ ...request, payload: { identity, text: 'Draft' } })).toBe(false);
        expect(isExtRequest({ ...request, payload: { ...request.payload, identity: { ...identity, assistantMessageId: '' } } })).toBe(false);
        expect(isExtRequest({ ...request, payload: { ...request.payload, expectedRevision: -1 } })).toBe(false);
        expect(isExtRequest({ ...request, type: 'annotations:draftRead', payload: { identity } })).toBe(true);
    });
});
