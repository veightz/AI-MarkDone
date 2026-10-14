import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createRequestId, PROTOCOL_VERSION, type ExtRequest } from '@/contracts/protocol';
import { ANNOTATION_DRAFT_LIMITS, type AnnotationDraftIdentity } from '@/contracts/annotationDrafts';
import { STORAGE_KEYS } from '@/contracts/storage';

const identity: AnnotationDraftIdentity = { documentKey: 'chatgpt:conversation:one', assistantMessageId: 'assistant', selectionKey: 'quote/context' };
function request(type: 'annotations:draftRead' | 'annotations:draftWrite' | 'annotations:draftRemove', payload: Record<string, unknown>): ExtRequest {
    return { v: PROTOCOL_VERSION, id: createRequestId(), type, payload: { identity, ...payload } } as ExtRequest;
}
async function setup(initial: Record<string, unknown> = {}) {
    const store = { ...initial };
    vi.stubGlobal('browser', { runtime: { getManifest: () => ({ manifest_version: 3 }) }, storage: { local: {
        get: vi.fn(async (key: string) => ({ [key]: store[key] })), set: vi.fn(async (patch: Record<string, unknown>) => Object.assign(store, patch)),
    } } });
    const { handleAnnotationDraftRequest: handle } = await import('@/runtimes/background/handlers/annotationDrafts');
    return { store, handle };
}
describe('background annotation recovery drafts', () => {
    beforeEach(() => { vi.resetModules(); vi.unstubAllGlobals(); });
    it.each([{ schemaVersion: 2, drafts: [] }, { schemaVersion: 1, drafts: [{ text: 'Corrupt but retained' }] }, { schemaVersion: 1, drafts: [], revisionCounter: 'unknown' }])('fails closed on unsupported or corrupt storage without rewriting it', async stored => {
        const { store, handle } = await setup({ [STORAGE_KEYS.annotationDraftsV1]: stored });
        expect((await handle(request('annotations:draftWrite', { text: 'New', expectedRevision: 0 })))?.response.ok).toBe(false);
        expect((await handle(request('annotations:draftRead', {})))?.response.ok).toBe(false);
        expect(store[STORAGE_KEYS.annotationDraftsV1]).toEqual(stored);
    });
    it('restores a draft after a new background instance without touching annotation settings', async () => {
        const { store, handle } = await setup(); await handle(request('annotations:draftWrite', { text: 'Unfinished', expectedRevision: 0 }));
        vi.resetModules(); const reloaded = await setup(store);
        expect((await reloaded.handle(request('annotations:draftRead', {})))?.response).toMatchObject({ ok: true, data: { draft: { text: 'Unfinished' }, revision: 1 } });
        expect(Object.keys(store)).toEqual([STORAGE_KEYS.annotationDraftsV1]);
    });
    it('rejects a stale write and stale clear without overwriting the newer window', async () => {
        const { handle } = await setup(); await handle(request('annotations:draftWrite', { text: 'First', expectedRevision: 0 }));
        await handle(request('annotations:draftWrite', { text: 'Second', expectedRevision: 1 }));
        expect((await handle(request('annotations:draftWrite', { text: 'Stale', expectedRevision: 1 })))?.response).toMatchObject({ ok: false, error: { code: 'CONFLICT' } });
        expect((await handle(request('annotations:draftRemove', { expectedRevision: 1 })))?.response.ok).toBe(false);
        expect((await handle(request('annotations:draftRead', {})))?.response).toMatchObject({ data: { draft: { text: 'Second' } } });
    });
    it('never reuses a revision after deletion and recreation', async () => {
        const { handle } = await setup(); await handle(request('annotations:draftWrite', { text: 'First', expectedRevision: 0 }));
        await handle(request('annotations:draftRemove', { expectedRevision: 1 }));
        await handle(request('annotations:draftWrite', { text: 'Recreated', expectedRevision: 0 }));
        expect((await handle(request('annotations:draftWrite', { text: 'Old editor', expectedRevision: 1 })))?.response).toMatchObject({ ok: false, error: { code: 'CONFLICT' } });
    });
    it('rejects oversized text without trimming or changing the existing recovery text', async () => {
        const { handle } = await setup(); await handle(request('annotations:draftWrite', { text: 'Retained', expectedRevision: 0 }));
        expect((await handle(request('annotations:draftWrite', { text: 'x'.repeat(ANNOTATION_DRAFT_LIMITS.textLength + 1), expectedRevision: 1 })))?.response).toMatchObject({ ok: false, error: { code: 'QUOTA_EXCEEDED' } });
        expect((await handle(request('annotations:draftRead', {})))?.response).toMatchObject({ data: { draft: { text: 'Retained' } } });
    });
    it('expires old drafts and refuses to evict recent drafts when capacity is reached', async () => {
        const drafts = Array.from({ length: ANNOTATION_DRAFT_LIMITS.count }, (_, index) => ({ identity: { ...identity, assistantMessageId: `message-${index}` }, text: 'Keep', revision: index + 1, updatedAt: Date.now() }));
        const { handle, store } = await setup({ [STORAGE_KEYS.annotationDraftsV1]: { schemaVersion: 1, drafts } });
        expect((await handle(request('annotations:draftWrite', { text: 'New', expectedRevision: 0 })))?.response).toMatchObject({ ok: false, error: { code: 'QUOTA_EXCEEDED' } });
        drafts[0]!.updatedAt = Date.now() - ANNOTATION_DRAFT_LIMITS.retentionMs - 1;
        expect((await handle(request('annotations:draftWrite', { text: 'New', expectedRevision: 0 })))?.response.ok).toBe(true);
        expect((store[STORAGE_KEYS.annotationDraftsV1] as { drafts: unknown[] }).drafts).toHaveLength(100);
    });
});
