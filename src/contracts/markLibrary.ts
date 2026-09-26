import { isReaderAnnotationDocument, type ReaderAnnotationDocument } from './readerAnnotations';
export const MARK_LIBRARY_KEY = 'aimd:mark_library:catalog:v1';
export type MarkFolder = {
    id: string;
    parentId: string | null;
    name: string;
    createdAt: number;
    updatedAt: number;
};
export type MarkConversation = {
    document: ReaderAnnotationDocument;
    folderId: string | null;
    customTitle: string | null;
    updatedAt: number;
};
export type MarkCatalog = {
    schemaVersion: 1;
    revision: number;
    folders: MarkFolder[];
    conversations: MarkConversation[];
};
export type MarkLibraryOperation = {
    type: 'folder-put';
    create?: boolean;
    id: string;
    parentId: string | null;
    name: string;
} | {
    type: 'folder-remove';
    id: string;
} | {
    type: 'move';
    documents: ReaderAnnotationDocument[];
    folderId: string | null;
} | {
    type: 'rename';
    document: ReaderAnnotationDocument;
    title: string | null;
};
export function emptyMarkCatalog(): MarkCatalog { return { schemaVersion: 1, revision: 0, folders: [], conversations: [] }; }
const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const id = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0 && value.length <= 512;
const nullableId = (value: unknown): value is string | null => value === null || id(value);
const title = (value: unknown): value is string | null => value === null || (typeof value === 'string' && value.length <= 512);
export function isMarkLibraryOperation(value: unknown): value is MarkLibraryOperation {
    if (!object(value))
        return false;
    switch (value.type) {
        case 'folder-put': return (value.create === undefined || typeof value.create === 'boolean') && id(value.id) && nullableId(value.parentId) && typeof value.name === 'string' && value.name.length <= 100;
        case 'folder-remove': return id(value.id);
        case 'move': return nullableId(value.folderId) && Array.isArray(value.documents) && value.documents.length > 0 && value.documents.every(isReaderAnnotationDocument);
        case 'rename': return isReaderAnnotationDocument(value.document) && title(value.title);
        default: return false;
    }
}
export function isMarkCatalog(value: unknown): value is MarkCatalog {
    if (!object(value) || value.schemaVersion !== 1 || !Number.isSafeInteger(value.revision) || (value.revision as number) < 0)
        return false;
    return Array.isArray(value.folders) && value.folders.every(f => object(f) && id(f.id) && nullableId(f.parentId) && typeof f.name === 'string' && !!f.name.trim() && f.name.length <= 100 && Number.isFinite(f.createdAt) && Number.isFinite(f.updatedAt))
        && Array.isArray(value.conversations) && value.conversations.every(c => object(c) && isReaderAnnotationDocument(c.document) && nullableId(c.folderId) && title(c.customTitle) && Number.isFinite(c.updatedAt));
}
export function usableConversationTitle(value: unknown, conversationId: string): string | null {
    if (typeof value !== 'string')
        return null;
    const clean = value.trim().slice(0, 512);
    return !clean || clean === conversationId || /^(?:https?:\/\/|chatgpt$|new chat$|新聊天$)/i.test(clean) ? null : clean;
}
