import type { Bookmark, Folder } from '../../../core/bookmarks/types';
import { exportBookmarks, planImportBookmarks } from '../../../services/bookmarks/bookmarksService';
import { buildBookmarkStorageKeyForBookmark } from '../../../core/bookmarks/keys';
import { PathUtils } from '../../../core/bookmarks/path';
import { parseImportData } from '../../../core/bookmarks/importExport';
import { buildCloudBackupRestorePlan, createLibraryCloudBackupSnapshot, excludeBookmarkStorageKeyConflicts, validateCloudBackupSnapshot } from '../../../core/cloudBackup/snapshot';
import { buildLibraryRestorePlan, isLibraryBackupPayload, isValidMarkCatalogTree } from '../../../core/cloudBackup/library';
import type { CloudBackupSnapshot, LibraryExportPayloadV4 } from '../../../core/cloudBackup/types';
import { decodeHighlightBundle, HIGHLIGHT_STORAGE_PREFIX, highlightStorageKey, type HighlightBundle } from '../../../contracts/highlights';
import { decodeReaderAnnotationBundle, readerAnnotationStorageKey, type ReaderAnnotationBundleV1 } from '../../../contracts/readerAnnotations';
import { emptyMarkCatalog, MARK_LIBRARY_KEY } from '../../../contracts/markLibrary';
import { LEGACY_STORAGE_KEYS, STORAGE_KEYS } from '../../../contracts/storage';
import { bookmarksIndexStore } from '../../../drivers/background/storage/bookmarksIndexStore';
import { localStoragePort } from '../../../drivers/background/storage/localStoragePort';

export type LibraryStorageReaders = {
    loadBookmarks(now: number): Promise<Bookmark[]>;
    loadFolders(): Promise<{ folderPaths: string[]; folders: Folder[] }>;
    ensureFolders(params: { requiredPaths: string[]; folderPaths: string[]; folders: Folder[]; now: number }): Promise<{
        updatedFolderPaths: string[]; folderSetPatch: Record<string, Folder>; failedPaths: string[];
    }>;
};

export async function saveVerifiedEmergencySnapshot(key: string, record: { snapshot: CloudBackupSnapshot }): Promise<void> {
    await localStoragePort.set({ [key]: record });
    const stored = (await localStoragePort.get(key))[key] as { snapshot?: unknown } | undefined;
    const snapshot = await validateCloudBackupSnapshot(stored?.snapshot);
    if (snapshot.snapshotId !== record.snapshot.snapshotId || snapshot.payloadHash !== record.snapshot.payloadHash) {
        throw new Error('INTEGRITY_MISMATCH');
    }
}

export async function captureLibraryExport(now: number, readers: LibraryStorageReaders): Promise<LibraryExportPayloadV4> {
    const [bookmarks, bookmarkIndex, { folderPaths, folders }, raw] = await Promise.all([
        readers.loadBookmarks(now), bookmarksIndexStore.buildIndexIfMissing(now), readers.loadFolders(), localStoragePort.get(null),
    ]);
    const indexedBookmarks = new Set(bookmarkIndex);
    const storedBookmarks = Object.keys(raw).filter(key => key.startsWith(LEGACY_STORAGE_KEYS.bookmarkKeyPrefix));
    const indexedFolders = new Set(folderPaths.map(path => `${LEGACY_STORAGE_KEYS.folderKeyPrefix}${path}`));
    const storedFolders = Object.keys(raw).filter(key => key.startsWith(LEGACY_STORAGE_KEYS.folderKeyPrefix));
    if (bookmarks.length !== bookmarkIndex.length || folders.length !== folderPaths.length
        || storedBookmarks.length !== indexedBookmarks.size || storedBookmarks.some(key => !indexedBookmarks.has(key))
        || storedFolders.length !== indexedFolders.size || storedFolders.some(key => !indexedFolders.has(key))) {
        throw new Error('SNAPSHOT_CORRUPTED');
    }
    const highlights: HighlightBundle[] = [];
    const annotations: ReaderAnnotationBundleV1[] = [];
    for (const [key, value] of Object.entries(raw)) {
        if (key.startsWith(HIGHLIGHT_STORAGE_PREFIX)) {
            const bundle = decodeHighlightBundle(value);
            if (!bundle || highlightStorageKey(bundle.document) !== key) throw new Error('SNAPSHOT_CORRUPTED');
            highlights.push(bundle);
        } else if (key.startsWith(STORAGE_KEYS.readerAnnotationsDocumentPrefixV1)) {
            const bundle = decodeReaderAnnotationBundle(value);
            if (!bundle || readerAnnotationStorageKey(bundle.document) !== key) throw new Error('SNAPSHOT_CORRUPTED');
            annotations.push(bundle);
        }
    }
    const markCatalog = raw[MARK_LIBRARY_KEY] === undefined ? emptyMarkCatalog() : raw[MARK_LIBRARY_KEY];
    if (!isValidMarkCatalogTree(markCatalog)) throw new Error('SNAPSHOT_CORRUPTED');
    const exported = exportBookmarks({ bookmarks, preserveStructure: true }).payload;
    const payload: LibraryExportPayloadV4 = {
        version: '4.0', exportDate: exported.exportDate, bookmarks: exported.bookmarks,
        bookmarkFolders: folderPaths, highlights, annotations, markCatalog,
    };
    if (!isLibraryBackupPayload(payload)) throw new Error('SNAPSHOT_CORRUPTED');
    return payload;
}

export async function applyLibraryExport(params: {
    remote: LibraryExportPayloadV4;
    readers: LibraryStorageReaders;
    now: number;
    strategy: 'safeMerge' | 'replaceLocal';
    saveContextOnly?: boolean;
    sourceSnapshotId?: string;
    quotaBytes: number;
}) {
    const { remote, readers, now, strategy } = params;
    if (!isLibraryBackupPayload(remote)) throw new Error('SNAPSHOT_CORRUPTED');
    const existingIndex = await bookmarksIndexStore.buildIndexIfMissing(now);
    const local = await captureLibraryExport(now, readers);
    const localBookmarks = parseImportData({ version: '3.0', bookmarks: local.bookmarks }).bookmarks;
    const remoteBookmarks = parseImportData({ version: '3.0', bookmarks: remote.bookmarks }).bookmarks;
    const bookmarkPlan = excludeBookmarkStorageKeyConflicts(
        buildCloudBackupRestorePlan({ localBookmarks, remoteBookmarks, strategy }), existingIndex,
    );
    const markPlan = buildLibraryRestorePlan(local, remote, strategy);
    const usedBytes = await localStoragePort.getBytesInUse(null);
    const importPlan = planImportBookmarks({
        jsonText: JSON.stringify({ version: '3.0', exportDate: remote.exportDate, bookmarks: bookmarkPlan.bookmarksToUpsert }),
        existing: strategy === 'replaceLocal' ? [] : localBookmarks,
        existingIndex: strategy === 'replaceLocal' ? [] : existingIndex,
        now, usedBytes, quotaBytes: params.quotaBytes, saveContextOnly: Boolean(params.saveContextOnly),
    });
    if (!importPlan.quota.canImport) throw new Error('QUOTA_EXCEEDED');
    const { folderPaths, folders } = await readers.loadFolders();
    const requiredPaths = new Set(importPlan.foldersToEnsure);
    for (const path of remote.bookmarkFolders) {
        for (const parent of PathUtils.getAncestors(path)) requiredPaths.add(parent);
        requiredPaths.add(path);
    }
    const orderedPaths = [...requiredPaths].sort((a, b) => PathUtils.getDepth(a) - PathUtils.getDepth(b) || a.localeCompare(b));
    const ensure = await readers.ensureFolders({ requiredPaths: orderedPaths, folderPaths, folders, now });
    if (ensure.failedPaths.length) throw new Error('SNAPSHOT_CORRUPTED');

    const bookmarkPatch: Record<string, unknown> = {};
    for (const bookmark of importPlan.bookmarksToUpsert) bookmarkPatch[buildBookmarkStorageKeyForBookmark(bookmark)] = bookmark;
    const markPatch: Record<string, unknown> = {};
    for (const bundle of markPlan.highlightsToWrite) markPatch[highlightStorageKey(bundle.document)] = bundle;
    for (const bundle of markPlan.annotationsToWrite) markPatch[readerAnnotationStorageKey(bundle.document)] = bundle;
    if (markPlan.markCatalogToWrite) markPatch[MARK_LIBRARY_KEY] = markPlan.markCatalogToWrite;

    const replacement = strategy === 'replaceLocal';
    const nextBookmarkKeys = new Set(Object.keys(bookmarkPatch));
    const nextMarkKeys = new Set(Object.keys(markPatch));
    const staleKeys = replacement ? existingIndex.filter(key => !nextBookmarkKeys.has(key)) : [];
    if (replacement) {
        staleKeys.push(...local.highlights.map(bundle => highlightStorageKey(bundle.document)).filter(key => !nextMarkKeys.has(key)));
        staleKeys.push(...local.annotations.map(bundle => readerAnnotationStorageKey(bundle.document)).filter(key => !nextMarkKeys.has(key)));
        staleKeys.push(...folderPaths.filter(path => !requiredPaths.has(path)).map(path => `${LEGACY_STORAGE_KEYS.folderKeyPrefix}${path}`));
        const uiState = await localStoragePort.get(LEGACY_STORAGE_KEYS.lastSelectedFolderPath);
        const selectedPath = uiState[LEGACY_STORAGE_KEYS.lastSelectedFolderPath];
        if (typeof selectedPath === 'string' && !requiredPaths.has(selectedPath)) staleKeys.push(LEGACY_STORAGE_KEYS.lastSelectedFolderPath);
    }
    const patch = {
        ...ensure.folderSetPatch,
        [LEGACY_STORAGE_KEYS.folderPathsIndex]: replacement ? orderedPaths : ensure.updatedFolderPaths,
        ...bookmarkPatch,
        [STORAGE_KEYS.bookmarksIndexV1]: importPlan.updatedIndex,
        ...markPatch,
    };
    const emergencyId = crypto.randomUUID?.() ?? Math.random().toString(16).slice(2);
    const emergencySnapshotKey = replacement ? `aimd:cloud_backup:emergency_restore:googleDrive:v1:${now}:${emergencyId}` : null;
    const emergencyRecord = replacement
        ? { createdAt: new Date(now).toISOString(), sourceSnapshotId: params.sourceSnapshotId ?? null, snapshot: await createLibraryCloudBackupSnapshot(local) }
        : null;
    const additionalBytes = new TextEncoder().encode(JSON.stringify(emergencySnapshotKey && emergencyRecord
        ? { [emergencySnapshotKey]: emergencyRecord, ...patch }
        : patch)).byteLength;
    if (usedBytes + additionalBytes > params.quotaBytes) throw new Error('QUOTA_EXCEEDED');

    if (emergencySnapshotKey && emergencyRecord) await saveVerifiedEmergencySnapshot(emergencySnapshotKey, emergencyRecord);
    await localStoragePort.set(patch);
    if (staleKeys.length) await localStoragePort.remove(staleKeys);
    return {
        imported: importPlan.bookmarksToUpsert.length,
        restored: importPlan.bookmarksToUpsert.length,
        skippedDuplicates: bookmarkPlan.duplicateCount,
        conflicts: bookmarkPlan.conflictCount,
        localOnly: bookmarkPlan.localOnlyCount,
        renamed: importPlan.renamedTitles.length,
        warnings: importPlan.warnings,
        folderCreateFailures: 0,
        library: markPlan.counts,
        emergencySnapshotKey,
    };
}
