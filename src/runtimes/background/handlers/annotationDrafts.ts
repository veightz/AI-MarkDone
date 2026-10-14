import { ANNOTATION_DRAFT_LIMITS, annotationDraftKey, decodeAnnotationDrafts } from '../../../contracts/annotationDrafts';
import { PROTOCOL_VERSION, type ExtRequest, type ExtResponse, type ProtocolErrorCode } from '../../../contracts/protocol';
import { STORAGE_KEYS } from '../../../contracts/storage';
import { backgroundStorageQueue } from '../../../drivers/background/storage/asyncQueue';
import { localStoragePort } from '../../../drivers/background/storage/localStoragePort';

export async function handleAnnotationDraftRequest(request: ExtRequest): Promise<{ response: ExtResponse } | null> {
    if (request.type !== 'annotations:draftRead' && request.type !== 'annotations:draftWrite' && request.type !== 'annotations:draftRemove') return null;
    const { identity, text, expectedRevision } = request.payload;
    const fail = (code: ProtocolErrorCode, message: string): { response: ExtResponse } => ({ response: { v: PROTOCOL_VERSION, id: request.id, type: request.type, ok: false, error: { code, message } } });
    return backgroundStorageQueue.enqueue(async () => {
        try {
            const raw = await localStoragePort.get(STORAGE_KEYS.annotationDraftsV1);
            const stored = raw[STORAGE_KEYS.annotationDraftsV1];
            const all = decodeAnnotationDrafts(stored);
            if (stored !== undefined && (!stored || typeof stored !== 'object' || (stored as { schemaVersion?: unknown }).schemaVersion !== 1
                || !Array.isArray((stored as { drafts?: unknown }).drafts) || all.length !== (stored as { drafts: unknown[] }).drafts.length
                || ((stored as { revisionCounter?: unknown }).revisionCounter !== undefined && (!Number.isSafeInteger((stored as { revisionCounter: number }).revisionCounter) || (stored as { revisionCounter: number }).revisionCounter < 0)))) {
                return fail('INTERNAL_ERROR', 'Annotation draft storage could not be read');
            }
            const storedCounter = (raw[STORAGE_KEYS.annotationDraftsV1] as { revisionCounter?: number } | undefined)?.revisionCounter ?? 0;
            const revision = Math.max(storedCounter, ...all.map(item => item.revision), 0) + 1;
            const key = annotationDraftKey(identity);
            const current = all.find(item => annotationDraftKey(item.identity) === key);
            if (request.type === 'annotations:draftRead') {
                const draft = current && Date.now() - current.updatedAt <= ANNOTATION_DRAFT_LIMITS.retentionMs ? current : null;
                return { response: { v: PROTOCOL_VERSION, id: request.id, type: request.type, ok: true, data: { draft, revision: current?.revision ?? 0 } } };
            }
            if ((current?.revision ?? 0) !== expectedRevision) return fail('CONFLICT', 'Annotation draft changed in another window');
            // Expire old recovery data only; never evict a recent draft to admit a new one.
            const next = all.filter(item => annotationDraftKey(item.identity) !== key && Date.now() - item.updatedAt <= ANNOTATION_DRAFT_LIMITS.retentionMs);
            if (request.type === 'annotations:draftWrite') {
                if (text!.length > ANNOTATION_DRAFT_LIMITS.textLength) return fail('QUOTA_EXCEEDED', 'Annotation draft exceeds the local recovery limit');
                next.push({ identity, text: text!, revision, updatedAt: Date.now() });
            }
            const bundle = { schemaVersion: 1, revisionCounter: revision, drafts: next };
            if (next.length > ANNOTATION_DRAFT_LIMITS.count || new TextEncoder().encode(JSON.stringify(bundle)).byteLength > ANNOTATION_DRAFT_LIMITS.bytes) return fail('QUOTA_EXCEEDED', 'Annotation draft storage is full');
            await localStoragePort.set({ [STORAGE_KEYS.annotationDraftsV1]: bundle });
            return { response: { v: PROTOCOL_VERSION, id: request.id, type: request.type, ok: true, data: { revision: request.type === 'annotations:draftRemove' ? 0 : revision } } };
        } catch (error) {
            return fail(/quota|exceed/i.test(String(error)) ? 'QUOTA_EXCEEDED' : 'INTERNAL_ERROR', 'Annotation draft could not be saved');
        }
    });
}
