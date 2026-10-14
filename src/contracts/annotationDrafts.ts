import { readerAnnotationDocumentKey, type ReaderAnnotationDocument } from './readerAnnotations';

export const ANNOTATION_DRAFT_LIMITS = { count: 100, textLength: 20_000, bytes: 1_048_576, retentionMs: 30 * 24 * 60 * 60 * 1000 } as const;

/** Drafts are local recovery data, never committed annotations or backup content. */
export type AnnotationDraftIdentity = { documentKey: string; assistantMessageId: string; selectionKey: string };
export type AnnotationDraft = { identity: AnnotationDraftIdentity; text: string; revision: number; updatedAt: number };
export type AnnotationDraftPayload = { identity: AnnotationDraftIdentity; text?: string; expectedRevision?: number };
type DraftResult<T> = { ok: true; data: T } | { ok: false; errorCode: string };
export type AnnotationDraftClient = {
    read: (identity: AnnotationDraftIdentity) => Promise<DraftResult<{ draft: AnnotationDraft | null; revision: number }>>;
    write: (identity: AnnotationDraftIdentity, text: string, expectedRevision: number) => Promise<DraftResult<{ revision: number }>>;
    remove: (identity: AnnotationDraftIdentity, expectedRevision: number) => Promise<DraftResult<{ revision: number }>>;
};

export function createAnnotationDraftIdentity(document: ReaderAnnotationDocument | null, assistantMessageId: string | null | undefined,
    selection: { annotationId?: string; sourceMarkdown: string; textQuote: { exact: string; prefix: string; suffix: string }; textPosition?: { start: number | null; end: number | null } }): AnnotationDraftIdentity | null {
    if (!document || !assistantMessageId || !document.conversationId.trim() || /^chatgpt:/i.test(document.conversationId)) return null;
    return { documentKey: readerAnnotationDocumentKey(document), assistantMessageId,
        // Quote context disambiguates repeated text without persisting view-specific DOM paths.
        selectionKey: selection.annotationId ? `annotation:${selection.annotationId}` : JSON.stringify([selection.sourceMarkdown, selection.textQuote, selection.textPosition]) };
}
export function annotationDraftKey(identity: AnnotationDraftIdentity): string {
    return JSON.stringify([identity.documentKey, identity.assistantMessageId, identity.selectionKey]);
}
export function isAnnotationDraftIdentity(value: unknown): value is AnnotationDraftIdentity {
    if (!value || typeof value !== 'object') return false;
    const item = value as Record<string, unknown>;
    try {
        if (typeof item.documentKey !== 'string' || /^chatgpt:/i.test(decodeURIComponent(item.documentKey.slice('chatgpt:conversation:'.length)))) return false;
    } catch { return false; }
    return typeof item.documentKey === 'string' && item.documentKey.startsWith('chatgpt:conversation:')
        && item.documentKey.length > 'chatgpt:conversation:'.length
        && typeof item.assistantMessageId === 'string' && item.assistantMessageId.trim().length > 0
        && typeof item.selectionKey === 'string' && item.selectionKey.length > 0 && item.selectionKey.length <= 100_000;
}
export function decodeAnnotationDrafts(value: unknown): AnnotationDraft[] {
    if (!value || typeof value !== 'object') return [];
    const bundle = value as { schemaVersion?: unknown; drafts?: unknown };
    if (bundle.schemaVersion !== 1 || !Array.isArray(bundle.drafts)) return [];
    return bundle.drafts.filter((entry): entry is AnnotationDraft => entry && isAnnotationDraftIdentity(entry.identity)
        && typeof entry.text === 'string' && entry.text.length <= ANNOTATION_DRAFT_LIMITS.textLength
        && Number.isSafeInteger(entry.revision) && entry.revision > 0 && Number.isFinite(entry.updatedAt));
}
