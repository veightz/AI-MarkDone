import { PathUtils } from '../bookmarks/path';
import { decodeHighlightBundle, type HighlightBundle } from '../../contracts/highlights';
import { isMarkCatalog, type MarkCatalog, type MarkFolder } from '../../contracts/markLibrary';
import { decodeReaderAnnotationBundle, readerAnnotationDocumentKey, type ReaderAnnotationBundleV1 } from '../../contracts/readerAnnotations';
import { parseImportData } from '../bookmarks/importExport';
import type { LibraryExportPayloadV4 } from './types';

type Counts = { added: number; duplicate: number; conflict: number };
export type LibraryRestoreCounts = {
    bookmarkFolders: Counts;
    highlights: Counts;
    annotations: Counts;
    folders: Counts;
    conversations: Counts;
};
export type LibraryRestorePlan = {
    highlightsToWrite: HighlightBundle[];
    annotationsToWrite: ReaderAnnotationBundleV1[];
    markCatalogToWrite: MarkCatalog | null;
    counts: LibraryRestoreCounts;
};

const emptyCounts = (): Counts => ({ added: 0, duplicate: 0, conflict: 0 });
const documentKey = (bundle: HighlightBundle | ReaderAnnotationBundleV1): string => readerAnnotationDocumentKey(bundle.document);

function validBundles<T extends HighlightBundle | ReaderAnnotationBundleV1>(
    bundles: unknown, decode: (value: unknown) => T | null, records: (bundle: T) => Array<{ id: string }>,
): boolean {
    if (!Array.isArray(bundles)) return false;
    const documents = new Set<string>();
    for (const raw of bundles) {
        const bundle = decode(raw);
        if (!bundle) return false;
        const key = documentKey(bundle);
        const items = records(bundle);
        if (documents.has(key) || new Set(items.map(item => item.id)).size !== items.length) return false;
        documents.add(key);
    }
    return true;
}

export function isValidMarkCatalogTree(value: unknown): value is MarkCatalog {
    if (!isMarkCatalog(value)) return false;
    const folders = new Map(value.folders.map(folder => [folder.id, folder]));
    if (folders.size !== value.folders.length) return false;
    const names = new Set<string>();
    for (const folder of value.folders) {
        if (!PathUtils.getFolderNameValidation(folder.name).isValid) return false;
        const sibling = `${folder.parentId ?? ''}\0${folder.name.trim().toLocaleLowerCase()}`;
        if (names.has(sibling)) return false;
        names.add(sibling);
        const seen = new Set<string>();
        let current: MarkFolder | undefined = folder;
        while (current) {
            if (seen.has(current.id) || seen.size >= 4) return false;
            seen.add(current.id);
            if (current.parentId === null) break;
            current = folders.get(current.parentId);
            if (!current) return false;
        }
    }
    const conversations = new Set<string>();
    for (const conversation of value.conversations) {
        const key = readerAnnotationDocumentKey(conversation.document);
        if (conversations.has(key) || (conversation.folderId !== null && !folders.has(conversation.folderId))) return false;
        conversations.add(key);
    }
    return true;
}

export function isLibraryBackupPayload(value: unknown): value is LibraryExportPayloadV4 {
    if (!value || typeof value !== 'object') return false;
    const payload = value as LibraryExportPayloadV4;
    if (payload.version !== '4.0' || typeof payload.exportDate !== 'string') return false;
    const bookmarks = parseImportData({ version: '3.0', exportDate: payload.exportDate, bookmarks: payload.bookmarks });
    if (bookmarks.sourceFormat !== 'v3' || bookmarks.invalidCount || bookmarks.warnings.length) return false;
    if (!Array.isArray(payload.bookmarkFolders) || !payload.bookmarkFolders.every(path => {
        if (typeof path !== 'string') return false;
        try { return PathUtils.normalize(path) === path && PathUtils.getDepth(path) <= PathUtils.MAX_DEPTH; }
        catch { return false; }
    }) || new Set(payload.bookmarkFolders).size !== payload.bookmarkFolders.length) return false;
    if (!isValidMarkCatalogTree(payload.markCatalog)) return false;
    return validBundles(payload.highlights, value => decodeHighlightBundle(value), bundle => bundle.highlights)
        && validBundles(payload.annotations, value => decodeReaderAnnotationBundle(value), bundle => bundle.annotations);
}

function mergeBundles<T extends HighlightBundle | ReaderAnnotationBundleV1, R extends { id: string }>(
    local: T[], remote: T[], records: (bundle: T) => R[], withRecords: (bundle: T, items: R[]) => T,
    strategy: 'safeMerge' | 'replaceLocal',
): { writes: T[]; counts: Counts } {
    const counts = emptyCounts();
    if (strategy === 'replaceLocal') {
        counts.added = remote.reduce((sum, bundle) => sum + records(bundle).length, 0);
        return { writes: remote, counts };
    }
    const byDocument = new Map(local.map(bundle => [documentKey(bundle), bundle]));
    const writes: T[] = [];
    for (const incoming of remote) {
        const current = byDocument.get(documentKey(incoming));
        if (!current) {
            writes.push(incoming);
            counts.added += records(incoming).length;
            continue;
        }
        const known = new Map(records(current).map(record => [record.id, record]));
        const additions = records(incoming).filter(record => {
            const existing = known.get(record.id);
            if (!existing) { counts.added++; return true; }
            if (JSON.stringify(existing) === JSON.stringify(record)) counts.duplicate++;
            else counts.conflict++;
            return false;
        });
        if (additions.length) writes.push(withRecords(current, [...records(current), ...additions]));
    }
    return { writes, counts };
}

function mergeCatalog(local: MarkCatalog, remote: MarkCatalog, strategy: 'safeMerge' | 'replaceLocal'): { catalog: MarkCatalog | null; folders: Counts; conversations: Counts } {
    const folders = emptyCounts();
    const conversations = emptyCounts();
    if (strategy === 'replaceLocal') {
        folders.added = remote.folders.length;
        conversations.added = remote.conversations.length;
        return { catalog: { ...remote, revision: Math.max(local.revision, remote.revision) + 1 }, folders, conversations };
    }
    const next = structuredClone(local);
    const usedIds = new Set(next.folders.map(folder => folder.id));
    const mappedIds = new Map<string, string>();
    const remaining = new Map(remote.folders.map(folder => [folder.id, folder]));
    while (remaining.size) {
        let advanced = false;
        for (const [id, folder] of remaining) {
            if (folder.parentId && !mappedIds.has(folder.parentId)) continue;
            const parentId = folder.parentId ? mappedIds.get(folder.parentId)! : null;
            const match = next.folders.find(item => item.parentId === parentId && item.name.trim().toLocaleLowerCase() === folder.name.trim().toLocaleLowerCase());
            if (match) {
                mappedIds.set(id, match.id);
                folders.duplicate++;
            } else {
                let newId = id;
                for (let suffix = 1; usedIds.has(newId); suffix++) newId = `${id.slice(0, 480)}-import-${suffix}`;
                next.folders.push({ ...folder, id: newId, parentId });
                mappedIds.set(id, newId);
                usedIds.add(newId);
                folders.added++;
            }
            remaining.delete(id);
            advanced = true;
        }
        if (!advanced) throw new Error('SNAPSHOT_CORRUPTED');
    }
    const byDocument = new Map(next.conversations.map(item => [readerAnnotationDocumentKey(item.document), item]));
    for (const incoming of remote.conversations) {
        const folderId = incoming.folderId ? mappedIds.get(incoming.folderId)! : null;
        const current = byDocument.get(readerAnnotationDocumentKey(incoming.document));
        if (current) {
            if (current.folderId === folderId && current.customTitle === incoming.customTitle) conversations.duplicate++;
            else conversations.conflict++;
        } else {
            next.conversations.push({ ...incoming, folderId });
            conversations.added++;
        }
    }
    const changed = folders.added > 0 || conversations.added > 0;
    if (changed) next.revision++;
    return { catalog: changed ? next : null, folders, conversations };
}

export function buildLibraryRestorePlan(local: LibraryExportPayloadV4, remote: LibraryExportPayloadV4, strategy: 'safeMerge' | 'replaceLocal'): LibraryRestorePlan {
    const bookmarkFolders = emptyCounts();
    const localPaths = new Set(local.bookmarkFolders);
    for (const path of remote.bookmarkFolders) {
        if (strategy === 'replaceLocal' || !localPaths.has(path)) bookmarkFolders.added++;
        else bookmarkFolders.duplicate++;
    }
    const highlights = mergeBundles(local.highlights, remote.highlights, bundle => bundle.highlights, (bundle, records) => ({ ...bundle, highlights: records }), strategy);
    const annotations = mergeBundles(local.annotations, remote.annotations, bundle => bundle.annotations, (bundle, records) => ({ ...bundle, annotations: records }), strategy);
    const catalog = mergeCatalog(local.markCatalog, remote.markCatalog, strategy);
    return {
        highlightsToWrite: highlights.writes,
        annotationsToWrite: annotations.writes,
        markCatalogToWrite: catalog.catalog,
        counts: { bookmarkFolders, highlights: highlights.counts, annotations: annotations.counts, folders: catalog.folders, conversations: catalog.conversations },
    };
}
