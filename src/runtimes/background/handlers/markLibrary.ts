import { PathUtils } from '../../../core/bookmarks/path';
import { emptyMarkCatalog, isMarkCatalog, isMarkLibraryOperation, MARK_LIBRARY_KEY, usableConversationTitle, type MarkCatalog, type MarkLibraryOperation } from '../../../contracts/markLibrary';
import { normalizeReaderAnnotationDocument, readerAnnotationDocumentKey } from '../../../contracts/readerAnnotations';
import { PROTOCOL_VERSION, type ExtRequest, type ExtResponse, type ProtocolErrorCode } from '../../../contracts/protocol';
import { backgroundStorageQueue } from '../../../drivers/background/storage/asyncQueue';
import { localStoragePort } from '../../../drivers/background/storage/localStoragePort';
/** Folder identities are stable; renames never rewrite source records or selectors. */
function validateTree(catalog: MarkCatalog): void {
    const folders = new Map(catalog.folders.map(folder => [folder.id, folder]));
    if (folders.size !== catalog.folders.length)
        throw new Error('Duplicate folder');
    const names = new Set<string>();
    for (const folder of folders.values()) {
        const name = `${folder.parentId ?? ''}\0${folder.name.trim().toLocaleLowerCase()}`;
        if (names.has(name))
            throw new Error('A folder with this name already exists');
        names.add(name);
        const seen = new Set<string>();
        let current: typeof folder | undefined = folder;
        while (current) {
            if (seen.has(current.id))
                throw new Error('A folder cannot contain itself');
            seen.add(current.id);
            if (seen.size > 4)
                throw new Error('Folders support up to four levels');
            if (current.parentId === null)
                break;
            current = folders.get(current.parentId);
            if (!current)
                throw new Error('Parent folder not found');
        }
    }
    const keys = catalog.conversations.map(c => readerAnnotationDocumentKey(c.document));
    if (new Set(keys).size !== keys.length)
        throw new Error('Duplicate conversation');
}
function apply(catalog: MarkCatalog, operation: MarkLibraryOperation): MarkCatalog {
    const next = structuredClone(catalog);
    const now = Date.now();
    if (operation.type === 'folder-put') {
        const validation = PathUtils.getFolderNameValidation(operation.name);
        const name = validation.normalized;
        if (!validation.isValid)
            throw new Error('Enter a valid folder name');
        const current = next.folders.find(f => f.id === operation.id);
        if (operation.create ? !!current : !current)
            throw new Error(operation.create ? 'Folder already exists' : 'Folder not found');
        next.folders = next.folders.filter(f => f.id !== operation.id);
        next.folders.push({ id: operation.id, parentId: operation.parentId, name, createdAt: current?.createdAt ?? now, updatedAt: now });
    }
    else if (operation.type === 'folder-remove') {
        if (!next.folders.some(f => f.id === operation.id))
            throw new Error('Folder not found');
        if (next.folders.some(f => f.parentId === operation.id) || next.conversations.some(c => c.folderId === operation.id))
            throw new Error('Folder must be empty before deletion');
        next.folders = next.folders.filter(f => f.id !== operation.id);
    }
    else {
        if (operation.type === 'move' && operation.folderId !== null && !next.folders.some(f => f.id === operation.folderId))
            throw new Error('Folder not found');
        const documents = operation.type === 'move' ? operation.documents : [operation.document];
        for (const document of documents) {
            const key = readerAnnotationDocumentKey(document);
            let item = next.conversations.find(c => readerAnnotationDocumentKey(c.document) === key);
            if (!item) {
                item = { document: normalizeReaderAnnotationDocument(document), folderId: null, customTitle: null, updatedAt: now };
                next.conversations.push(item);
            }
            const sourceTitle = usableConversationTitle(document.title, document.conversationId);
            item.document = normalizeReaderAnnotationDocument({ ...item.document, ...document, title: sourceTitle ?? item.document.title });
            if (operation.type === 'move')
                item.folderId = operation.folderId;
            else
                item.customTitle = operation.title?.trim() || null;
            item.updatedAt = now;
        }
    }
    validateTree(next);
    next.revision++;
    return next;
}
export async function handleMarkLibraryRequest(request: ExtRequest): Promise<{
    response: ExtResponse;
} | null> {
    if (request.type !== 'markLibrary:get' && request.type !== 'markLibrary:mutate')
        return null;
    const ok = (catalog: MarkCatalog) => ({ response: { v: PROTOCOL_VERSION, id: request.id, type: request.type, ok: true, data: { catalog } } as ExtResponse });
    const fail = (code: ProtocolErrorCode, message: string) => ({ response: { v: PROTOCOL_VERSION, id: request.id, type: request.type, ok: false, error: { code, message } } as ExtResponse });
    const operation = async () => {
        const raw = (await localStoragePort.get(MARK_LIBRARY_KEY))[MARK_LIBRARY_KEY];
        if (raw !== undefined && !isMarkCatalog(raw))
            return fail('SNAPSHOT_CORRUPTED', 'Could not read folders');
        const catalog = raw === undefined ? emptyMarkCatalog() : raw as MarkCatalog;
        try {
            validateTree(catalog);
        }
        catch {
            return fail('SNAPSHOT_CORRUPTED', 'Could not read folders');
        }
        if (request.type === 'markLibrary:get')
            return ok(catalog);
        if (!isMarkLibraryOperation(request.payload.operation))
            return fail('INVALID_REQUEST', 'Invalid library operation');
        if (request.payload.expectedRevision !== catalog.revision)
            return fail('CONFLICT', 'Library changed. Retry with the latest folders.');
        let next: MarkCatalog;
        try {
            next = apply(catalog, request.payload.operation);
        }
        catch (error) {
            return fail('INVALID_REQUEST', (error as Error).message);
        }
        await localStoragePort.set({ [MARK_LIBRARY_KEY]: next });
        return ok(next);
    };
    try {
        return request.type === 'markLibrary:get' ? await operation() : await backgroundStorageQueue.enqueue(operation);
    }
    catch (error) {
        return fail(/quota|exceed|maximum/i.test(String(error)) ? 'QUOTA_EXCEEDED' : 'INTERNAL_ERROR', 'Could not save folders');
    }
}
