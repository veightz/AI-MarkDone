import { describe, expect, it, vi } from 'vitest';
import { AnnotationDraftSession } from '@/services/reader/annotationDraftSession';
import type { AnnotationDraftIdentity } from '@/contracts/annotationDrafts';
import { createProtocolClientFailure } from '@/drivers/shared/clients/clientResult';

let sequence = 0;
function identity(): AnnotationDraftIdentity { return { documentKey: `chatgpt:conversation:session-${++sequence}`, assistantMessageId: 'assistant', selectionKey: 'selection' }; }
function client() {
    return { read: vi.fn().mockResolvedValue({ ok: true, data: { draft: null, revision: 0 } }),
        write: vi.fn().mockResolvedValue({ ok: true, data: { revision: 1 } }), remove: vi.fn().mockResolvedValue({ ok: true, data: { revision: 0 } }) };
}
describe('annotation recovery draft session', () => {
    it('recovers noncanonical text only under the same explicit runtime target key', async () => {
        const api = client(); const first = new AnnotationDraftSession(null, '', vi.fn(), vi.fn(), api, 'page:message-a:range-1');
        await first.ready; first.update('Temporary thought'); await first.flush();
        const restore = vi.fn(); const same = new AnnotationDraftSession(null, '', vi.fn(), restore, api, 'page:message-a:range-1'); await same.ready;
        expect(restore).toHaveBeenCalledWith('Temporary thought');
        const other = new AnnotationDraftSession(null, '', vi.fn(), vi.fn(), api, 'page:message-b:range-1'); await other.ready;
        expect(other.value).toBe(''); expect(api.read).not.toHaveBeenCalled(); expect(api.write).not.toHaveBeenCalled();
        await same.discard(); await other.discard();
    });
    it('restores saved text but never overwrites typing with a late initial read', async () => {
        const api = client(); let finish: (result: unknown) => void = () => undefined;
        api.read.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
        const restore = vi.fn(); const session = new AnnotationDraftSession(identity(), '', vi.fn(), restore, api);
        await Promise.resolve();
        session.update('New thought');
        finish({ ok: true, data: { draft: { text: 'Older thought' }, revision: 4 } });
        await session.ready; expect(await session.flush()).toBe(false);
        expect(restore).not.toHaveBeenCalled(); expect(session.value).toBe('New thought');
        expect(api.write).not.toHaveBeenCalled();
    });
    it('does not clear a newer input version when the submitted text is acknowledged', async () => {
        const api = client(); const session = new AnnotationDraftSession(identity(), '', vi.fn(), vi.fn(), api);
        await session.ready; session.update('Submitted'); await session.flush(); session.update('Continued writing');
        expect(await session.clearSubmitted('Submitted')).toBe(false);
        expect(session.value).toBe('Continued writing'); expect(api.remove).not.toHaveBeenCalled(); await session.flush();
    });
    it('keeps a newer failed recovery session when an older submission clears its own draft', async () => {
        const api = client(); const id = identity(); const old = new AnnotationDraftSession(id, '', vi.fn(), vi.fn(), api); await old.ready;
        old.update('Submitted'); await old.flush();
        api.read.mockResolvedValue({ ok: true, data: { draft: { text: 'Submitted' }, revision: 1 } });
        const newer = new AnnotationDraftSession(id, '', vi.fn(), vi.fn(), api); await newer.ready;
        api.write.mockResolvedValue(createProtocolClientFailure('QUOTA_EXCEEDED', 'Full')); newer.update('New unsaved text'); await newer.flush();
        await old.clearSubmitted('Submitted');
        const reopened = new AnnotationDraftSession(id, '', vi.fn(), vi.fn(), api); await reopened.ready;
        expect(reopened.value).toBe('New unsaved text'); await reopened.discard();
    });
    it('keeps text and does not overwrite another window after a revision conflict', async () => {
        const api = client(); api.write.mockResolvedValue(createProtocolClientFailure('CONFLICT', 'Changed'));
        const state = vi.fn(); const session = new AnnotationDraftSession(identity(), '', state, vi.fn(), api);
        await session.ready; session.update('Keep mine'); expect(await session.flush()).toBe(false);
        expect(session.value).toBe('Keep mine'); expect(state).toHaveBeenLastCalledWith('conflict');
        session.update('More of my thought'); expect(state).toHaveBeenLastCalledWith('conflict');
        expect(await session.flush()).toBe(false); expect(api.write).toHaveBeenCalledOnce();
        expect(await session.discard()).toBe(true); expect(api.remove).not.toHaveBeenCalled();
    });
    it('keeps the complete text after quota failure and supports retry', async () => {
        const api = client(); api.write.mockResolvedValueOnce(createProtocolClientFailure('QUOTA_EXCEEDED', 'Full'));
        const session = new AnnotationDraftSession(identity(), '', vi.fn(), vi.fn(), api); await session.ready;
        const text = 'Uncut text '.repeat(2200); session.update(text); expect(await session.flush()).toBe(false);
        expect(session.value).toBe(text); expect(await session.flush()).toBe(true); expect(api.write).toHaveBeenLastCalledWith(expect.anything(), text, 0);
    });
    it('returns to the saved status after reverting to the acknowledged draft text', async () => {
        const api = client(); const state = vi.fn(); const session = new AnnotationDraftSession(identity(), '', state, vi.fn(), api); await session.ready;
        session.update('Acknowledged'); await session.flush(); session.update('Change'); session.update('Acknowledged'); await session.flush();
        expect(state).toHaveBeenLastCalledWith('saved'); expect(api.write).toHaveBeenCalledOnce();
    });
    it('retries an unavailable initial read safely before writing', async () => {
        const api = client(); api.read.mockResolvedValueOnce(createProtocolClientFailure('INTERNAL_ERROR', 'Unavailable'));
        const session = new AnnotationDraftSession(identity(), '', vi.fn(), vi.fn(), api); await session.ready;
        session.update('Recovery'); expect(await session.flush()).toBe(true); expect(api.read).toHaveBeenCalledTimes(2);
    });
    it('clears only its acknowledged revision after successful submission', async () => {
        const api = client(); const session = new AnnotationDraftSession(identity(), '', vi.fn(), vi.fn(), api); await session.ready;
        session.update('Saved annotation'); expect(await session.clearSubmitted('Saved annotation')).toBe(true);
        expect(api.remove).toHaveBeenCalledWith(expect.anything(), 1);
    });
});
