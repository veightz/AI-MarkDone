import { createRequestId, PROTOCOL_VERSION, type ExtRequest } from '../../../contracts/protocol';
import { HIGHLIGHT_STORAGE_PREFIX, highlightStorageKey, isHighlightEntry, type HighlightEntry, type HighlightRecord } from '../../../contracts/highlights';
import type { ReaderAnnotationDocument } from '../../../contracts/readerAnnotations';
import { browser } from '../browser';
import { createInvalidResponseClientFailure, requestRuntimeClient, unwrapRuntimeClientResult } from './clientResult';

async function call(type: ExtRequest['type'], payload?: unknown): Promise<unknown> {
    return unwrapRuntimeClientResult(await requestRuntimeClient({v: PROTOCOL_VERSION, id: createRequestId(), type, payload} as ExtRequest));
}
function invalid(): never { return unwrapRuntimeClientResult(createInvalidResponseClientFailure('Invalid highlight response')); }
export const highlightsClient = {
    async list(document?: ReaderAnnotationDocument): Promise<HighlightEntry[]> {
        const data = await call('highlights:list', document ? {document} : undefined) as {entries?: unknown};
        if (!Array.isArray(data?.entries) || !data.entries.every(isHighlightEntry)) return invalid();
        return data.entries;
    },
    async create(document: ReaderAnnotationDocument, highlight: HighlightRecord): Promise<HighlightEntry> {
        const data = await call('highlights:create', {document, highlight});
        return isHighlightEntry(data) ? data : invalid();
    },
    async update(document: ReaderAnnotationDocument, highlight: HighlightRecord, expectedRevision: number): Promise<HighlightEntry> {
        const data = await call('highlights:update', {document, highlight, expectedRevision});
        return isHighlightEntry(data) ? data : invalid();
    },
    async remove(document: ReaderAnnotationDocument, highlightId: string, expectedRevision: number): Promise<void> {
        const data = await call('highlights:remove', {document, highlightId, expectedRevision}) as {deleted?: boolean; highlightId?: string};
        if (data?.deleted !== true || data.highlightId !== highlightId) invalid();
    },
    subscribe(onChanged: () => void, document?: ReaderAnnotationDocument): () => void {
        const events = browser?.storage?.onChanged;
        if (!events) return () => undefined;
        const key = document ? highlightStorageKey(document) : null;
        const listener = (changes: Record<string, unknown>, area: string) => {
            if (area === 'local' && Object.keys(changes).some(k => key ? k === key : k.startsWith(HIGHLIGHT_STORAGE_PREFIX))) onChanged();
        };
        events.addListener(listener);
        return () => events.removeListener(listener);
    },
};
