import { PROTOCOL_VERSION, type ExtRequest, type ExtResponse, type ProtocolErrorCode } from '../../../contracts/protocol';
import { decodeHighlightBundle, HIGHLIGHT_STORAGE_PREFIX, highlightStorageKey, sameHighlightSelection, type HighlightBundle, type HighlightEntry } from '../../../contracts/highlights';
import { mergeReaderAnnotationDocument, normalizeReaderAnnotationDocument } from '../../../contracts/readerAnnotations';
import { backgroundStorageQueue } from '../../../drivers/background/storage/asyncQueue';
import { localStoragePort } from '../../../drivers/background/storage/localStoragePort';

export async function handleHighlightRequest(request: ExtRequest): Promise<{ response: ExtResponse } | null> {
    if (!request.type.startsWith('highlights:')) return null;
    const req = request as Extract<ExtRequest, {type: `highlights:${string}`}>;
    const ok = (data: unknown): {response: ExtResponse} => ({ response: {v: PROTOCOL_VERSION, id: req.id, type: req.type, ok: true, data} });
    const fail = (code: ProtocolErrorCode, message: string): {response: ExtResponse} => ({ response: {v: PROTOCOL_VERSION, id: req.id, type: req.type, ok: false, error: {code, message}} });
    try {
        if (req.type === 'highlights:list') {
            const document = req.payload?.document;
            const raw = await localStoragePort.get(document ? highlightStorageKey(document) : null);
            const entries: HighlightEntry[] = [];
            for (const [key, value] of Object.entries(raw)) {
                if (!key.startsWith(HIGHLIGHT_STORAGE_PREFIX)) continue;
                const bundle = decodeHighlightBundle(value, document);
                if (!bundle) return fail('SNAPSHOT_CORRUPTED', 'Could not read highlights');
                entries.push(...bundle.highlights.map(highlight => ({document: bundle.document, highlight})));
            }
            return ok({ entries });
        }
        return await backgroundStorageQueue.enqueue(async () => {
            const { document } = req.payload;
            const key = highlightStorageKey(document);
            const raw = await localStoragePort.get(key);
            const bundle: HighlightBundle | null = raw[key] === undefined
                ? {schemaVersion: 1, document: normalizeReaderAnnotationDocument(document), highlights: []}
                : decodeHighlightBundle(raw[key], document);
            if (!bundle) return fail('SNAPSHOT_CORRUPTED', 'Could not read highlights');
            if (req.type === 'highlights:remove') {
                const current = bundle.highlights.find(h => h.id === req.payload.highlightId);
                if (!current) return fail('NOT_FOUND', 'Highlight not found');
                if (current.revision !== req.payload.expectedRevision) return fail('CONFLICT', 'Highlight changed');
                bundle.highlights = bundle.highlights.filter(h => h !== current);
                if (bundle.highlights.length) await localStoragePort.set({[key]: bundle});
                else await localStoragePort.remove(key);
                return ok({deleted: true, highlightId: current.id});
            }
            const incoming = req.payload.highlight;
            const current = bundle.highlights.find(h => req.type === 'highlights:create' ? sameHighlightSelection(h, incoming) : h.id === incoming.id);
            if (req.type === 'highlights:update') {
                if (!current) return fail('NOT_FOUND', 'Highlight not found');
                if (current.revision !== req.payload.expectedRevision) return fail('CONFLICT', 'Highlight changed');
                if (!sameHighlightSelection(current, incoming)) return fail('INVALID_REQUEST', 'Highlight target cannot change');
            } else if (!current && bundle.highlights.some(h => h.id === incoming.id)) return fail('CONFLICT', 'Highlight ID already exists');
            // Retrying a delivered create is idempotent. Recoloring preserves its identity and selectors.
            const metadata = mergeReaderAnnotationDocument(bundle.document, document);
            if (current?.color === incoming.color) {
                if (metadata.title !== bundle.document.title || metadata.lastKnownUrl !== bundle.document.lastKnownUrl) {
                    bundle.document = metadata;
                    await localStoragePort.set({[key]: bundle});
                }
                return ok({document: bundle.document, highlight: current});
            }
            const updatedAt = bundle.highlights.reduce((latest, h) => Math.max(latest, h.updatedAt + 1), Date.now());
            const canonical = current ? {...current, color: incoming.color, revision: current.revision + 1, updatedAt}
                : {...incoming, revision: 1, createdAt: Date.now(), updatedAt};
            bundle.highlights = [...bundle.highlights.filter(h => h.id !== canonical.id), canonical];
            bundle.document = metadata;
            await localStoragePort.set({[key]: bundle});
            return ok({document: bundle.document, highlight: canonical});
        });
    } catch (error) {
        return fail(/quota|exceed|maximum/i.test(String(error)) ? 'QUOTA_EXCEEDED' : 'INTERNAL_ERROR', 'Could not save highlights');
    }
}
