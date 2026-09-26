import { isReaderAnnotationDocument, isReaderAnnotationRecord, normalizeReaderAnnotationDocument, readerAnnotationDocumentKey, type ReaderAnnotationDocument, type ReaderAnnotationRecord } from './readerAnnotations';

export type HighlightColor = 'blue' | 'yellow' | 'red';
export const HIGHLIGHT_COLORS: readonly HighlightColor[] = ['blue', 'yellow', 'red'];
export type HighlightRecord = Omit<ReaderAnnotationRecord, 'comment' | 'lastKnownAnchorState'> & { color: HighlightColor };
export type HighlightEntry = { document: ReaderAnnotationDocument; highlight: HighlightRecord };
export type HighlightBundle = { schemaVersion: 1; document: ReaderAnnotationDocument; highlights: HighlightRecord[] };
export const HIGHLIGHT_STORAGE_PREFIX = 'aimd:highlights:document:v1:';
export function highlightStorageKey(document: ReaderAnnotationDocument): string { return HIGHLIGHT_STORAGE_PREFIX + readerAnnotationDocumentKey(document); }
export function isHighlightRecord(value: unknown): value is HighlightRecord {
    if (!value || typeof value !== 'object') return false;
    const record = value as HighlightRecord;
    return HIGHLIGHT_COLORS.includes(record.color) && isReaderAnnotationRecord({ ...record, comment: '', lastKnownAnchorState: 'anchored' });
}
export function isHighlightEntry(value: unknown): value is HighlightEntry {
    const entry = value as HighlightEntry | null;
    return !!entry && isReaderAnnotationDocument(entry.document) && isHighlightRecord(entry.highlight);
}
export function decodeHighlightBundle(value: unknown, document?: ReaderAnnotationDocument): HighlightBundle | null {
    const bundle = value as HighlightBundle | null;
    if (!bundle || bundle.schemaVersion !== 1 || !isReaderAnnotationDocument(bundle.document) || !Array.isArray(bundle.highlights) || !bundle.highlights.every(isHighlightRecord)) return null;
    if (document && readerAnnotationDocumentKey(document) !== readerAnnotationDocumentKey(bundle.document)) return null;
    return { ...bundle, document: normalizeReaderAnnotationDocument(bundle.document) };
}
/** DOM paths differ between the page and Reader, so equality uses text and message identity. */
export function sameHighlightSelection(a: HighlightRecord, b: HighlightRecord): boolean {
    return a.target.assistantMessageId === b.target.assistantMessageId
        && JSON.stringify(a.selectors.textQuote) === JSON.stringify(b.selectors.textQuote)
        && JSON.stringify(a.selectors.textPosition) === JSON.stringify(b.selectors.textPosition);
}
