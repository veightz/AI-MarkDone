import type { CloudBackupConnectedAccount, CloudBackupSessionState, ExtRequest, ExtResponse, ProtocolErrorCode } from '../../../contracts/protocol';
import { PROTOCOL_VERSION } from '../../../contracts/protocol';
import { LEGACY_STORAGE_KEYS, STORAGE_KEYS } from '../../../contracts/storage';
import { parseImportData } from '../../../core/bookmarks/importExport';
import { buildBookmarkStorageKeyForBookmark, rememberBookmarkStorageKey } from '../../../core/bookmarks/keys';
import { buildLibraryRestorePlan } from '../../../core/cloudBackup/library';
import { buildCloudBackupRestorePlan, createCloudBackupSnapshot, createLibraryCloudBackupSnapshot, excludeBookmarkStorageKeyConflicts, validateCloudBackupSnapshot } from '../../../core/cloudBackup/snapshot';
import type { CloudBackupSnapshot } from '../../../core/cloudBackup/types';
import { exportBookmarks, planImportBookmarks } from '../../../services/bookmarks/bookmarksService';
import { cloudBackupQueue } from '../../../drivers/background/cloudBackup/queue';
import { CloudBackupProviderError, type CloudBackupProvider } from '../../../drivers/background/cloudBackup/provider';
import { createGoogleDriveProvider } from '../../../drivers/background/cloudBackup/googleDriveProvider';
import { backgroundStorageQueue } from '../../../drivers/background/storage/asyncQueue';
import { bookmarksIndexStore } from '../../../drivers/background/storage/bookmarksIndexStore';
import { localStoragePort } from '../../../drivers/background/storage/localStoragePort';
import {
    ensureFolderRecordsExistForBackground,
    loadAllBookmarksForBackground,
    loadAllFoldersForBackground,
} from './bookmarks';
import { applyLibraryExport, captureLibraryExport, saveVerifiedEmergencySnapshot, type LibraryStorageReaders } from './libraryTransfer';

type HandlerResult = { response: ExtResponse };

let providerFactory: () => CloudBackupProvider = createGoogleDriveProvider;

export function setCloudBackupProviderFactoryForTests(factory: () => CloudBackupProvider): void {
    providerFactory = factory;
}

function ok(id: string, type: ExtRequest['type'], data?: unknown): ExtResponse {
    return { v: PROTOCOL_VERSION, id, ok: true, type, data };
}

function err(id: string, type: ExtRequest['type'], code: ProtocolErrorCode, message: string): ExtResponse {
    return { v: PROTOCOL_VERSION, id, ok: false, type, error: { code, message } };
}

function mapError(error: unknown): { code: ProtocolErrorCode; message: string } {
    if (error instanceof CloudBackupProviderError) {
        return { code: error.code, message: error.message };
    }
    const message = error instanceof Error ? error.message : String(error);
    if (message === 'INTEGRITY_MISMATCH') return { code: 'INTEGRITY_MISMATCH', message: 'Google Drive backup integrity check failed' };
    if (message === 'SCHEMA_UNSUPPORTED') return { code: 'SCHEMA_UNSUPPORTED', message: 'Google Drive backup schema is unsupported' };
    if (message === 'SNAPSHOT_CORRUPTED') return { code: 'SNAPSHOT_CORRUPTED', message: 'Google Drive backup snapshot is corrupted' };
    if (message === 'QUOTA_EXCEEDED' || /quota|exceed|maximum/i.test(message)) return { code: 'QUOTA_EXCEEDED', message: 'Not enough local storage to restore this backup' };
    if (message.includes('already running')) return { code: 'CONFLICT', message };
    return { code: 'INTERNAL_ERROR', message };
}

function getQuotaBytesFallback(): number {
    const chromeAny = (globalThis as any).chrome;
    const quota = chromeAny?.storage?.local?.QUOTA_BYTES;
    if (typeof quota === 'number' && quota > 0) return quota;
    return 10 * 1024 * 1024;
}

async function writeStatus(data: Record<string, unknown>): Promise<void> {
    await localStoragePort.set({ [STORAGE_KEYS.cloudBackupStatusGoogleDriveV1]: data });
}

async function readStatus(): Promise<Record<string, unknown>> {
    const raw = await localStoragePort.get([STORAGE_KEYS.cloudBackupStatusGoogleDriveV1]);
    const value = raw[STORAGE_KEYS.cloudBackupStatusGoogleDriveV1];
    return value && typeof value === 'object' ? value as Record<string, unknown> : {};
}

function buildConnectedAccount(status: Record<string, unknown>): CloudBackupConnectedAccount | null {
    const accountEmail = typeof status.accountEmail === 'string' ? status.accountEmail : null;
    const accountDisplayName = typeof status.accountDisplayName === 'string' ? status.accountDisplayName : null;
    const accountPhotoUrl = typeof status.accountPhotoUrl === 'string' ? status.accountPhotoUrl : null;
    if (!accountEmail && !accountDisplayName && !accountPhotoUrl) return null;
    return {
        accountEmail,
        accountDisplayName,
        accountPhotoUrl,
        connectedAt: typeof status.connectedAt === 'string' ? status.connectedAt : null,
    };
}

function isCloudBackupSessionState(value: unknown): value is CloudBackupSessionState {
    return value === 'unknown'
        || value === 'readyInThisSession'
        || value === 'needsConfirmation'
        || value === 'error';
}

function deriveStoredSessionState(status: Record<string, unknown>): CloudBackupSessionState {
    if (isCloudBackupSessionState(status.sessionState)) return status.sessionState;
    if (status.lastError) return 'error';
    if (status.connected) return 'needsConfirmation';
    return 'unknown';
}

function getReadOnlySessionState(stored: Record<string, unknown>): CloudBackupSessionState {
    if (!stored.connected) return 'unknown';
    const current = providerFactory().getSessionState?.() ?? deriveStoredSessionState(stored);
    return current === 'unknown' ? 'needsConfirmation' : current;
}

function isStaleBuildConfigurationError(value: unknown): boolean {
    return typeof value === 'string'
        && (
            value.includes('Google Drive backup is not configured in this build')
            || value.includes('Google Drive backup is only available in a Chrome build with the identity permission')
            || value.includes('Google Drive backup is missing the Chrome manifest OAuth client ID')
            || value.includes('Google Drive backup requires a configured Google Cloud Web OAuth client ID')
            || value.includes('Google Drive backup is configured with an invalid OAuth client')
            || value.includes('Chrome Extension OAuth client')
            || value.includes('manifest.oauth2 client_id/scopes')
            || value.includes("Unexpected property: 'state'")
        );
}

async function readCloudBackupStatus(): Promise<Record<string, unknown>> {
    const stored = await readStatus();
    const configuration = providerFactory().getConfigurationStatus?.();
    const connectedAccount = buildConnectedAccount(stored);
    const sessionState = getReadOnlySessionState(stored);
    if (!configuration || configuration.configured) {
        if (isStaleBuildConfigurationError(stored.lastError)) {
            const sanitized = { ...stored, lastError: null };
            await writeStatus(sanitized);
            return {
                ...sanitized,
                connectedAccount,
                sessionState,
                configured: true,
            };
        }
        return {
            ...stored,
            connectedAccount,
            sessionState,
            configured: true,
        };
    }
    return {
        ...stored,
        configured: false,
        connected: false,
        connectedAccount: null,
        sessionState: 'error',
        lastError: configuration.message,
    };
}

const libraryReaders: LibraryStorageReaders = {
    loadBookmarks: (now) => loadAllBookmarksForBackground(now),
    loadFolders: () => loadAllFoldersForBackground(),
    ensureFolders: (params) => ensureFolderRecordsExistForBackground(params),
};

function bookmarkPayload(snapshot: CloudBackupSnapshot) {
    return snapshot.schemaVersion === 3
        ? { version: '3.0' as const, exportDate: snapshot.payload.exportDate, bookmarks: snapshot.payload.bookmarks }
        : snapshot.payload;
}

async function storedBookmarkKeys(): Promise<string[]> {
    return Object.keys(await localStoragePort.get(null))
        .filter(key => key.startsWith(LEGACY_STORAGE_KEYS.bookmarkKeyPrefix));
}

function requireCompleteBookmarkIndex(index: string[], storedKeys: string[]): void {
    const indexed = new Set(index);
    if (indexed.size !== storedKeys.length || storedKeys.some(key => !indexed.has(key))) {
        throw new Error('SNAPSHOT_CORRUPTED');
    }
}

async function backupNow() {
    const payload = await backgroundStorageQueue.enqueue(() => captureLibraryExport(Date.now(), libraryReaders));
    const snapshot = await createLibraryCloudBackupSnapshot(payload);
    const summary = await providerFactory().uploadSnapshot(snapshot);
    const currentStatus = await readStatus();
    const verifiedAt = new Date().toISOString();
    await writeStatus({
        ...currentStatus,
        connected: true,
        sessionState: providerFactory().getSessionState?.() ?? 'readyInThisSession',
        lastBackupAt: verifiedAt,
        lastVerifiedAt: verifiedAt,
        lastSnapshotId: summary.snapshotId,
        lastError: null,
    });
    return {
        summary,
        bookmarkCount: payload.bookmarks.length,
        highlightCount: payload.highlights.reduce((sum, bundle) => sum + bundle.highlights.length, 0),
        annotationCount: payload.annotations.reduce((sum, bundle) => sum + bundle.annotations.length, 0),
        payloadHash: snapshot.payloadHash,
    };
}

async function previewRestore(snapshotId: string, strategy: 'previewOnly' | 'safeMerge' | 'replaceLocal') {
    const snapshot = await validateCloudBackupSnapshot(await providerFactory().downloadSnapshot(snapshotId));
    if (snapshot.snapshotId !== snapshotId) throw new CloudBackupProviderError('CONFLICT', 'Selected backup changed. Choose it again.');
    const parse = parseImportData(bookmarkPayload(snapshot));
    const { local, localBookmarks, storedKeys } = await backgroundStorageQueue.enqueue(async () => {
        const now = Date.now();
        const library = snapshot.schemaVersion === 3 ? await captureLibraryExport(now, libraryReaders) : null;
        const index = await bookmarksIndexStore.buildIndexIfMissing(now);
        const keys = library ? index : await storedBookmarkKeys();
        if (strategy === 'replaceLocal') requireCompleteBookmarkIndex(index, keys);
        const localBookmarks = library
            ? parseImportData({ version: '3.0', bookmarks: library.bookmarks }).bookmarks
            : await loadAllBookmarksForBackground(now);
        if (strategy === 'replaceLocal' && localBookmarks.length !== index.length) throw new Error('SNAPSHOT_CORRUPTED');
        return {
            local: library,
            localBookmarks,
            storedKeys: keys,
        };
    });
    const library = snapshot.schemaVersion === 3
        ? buildLibraryRestorePlan(local!, snapshot.payload, strategy === 'replaceLocal' ? 'replaceLocal' : 'safeMerge')
        : null;
    return {
        snapshot: {
            snapshotId: snapshot.snapshotId,
            createdAt: snapshot.createdAt,
            payloadHash: snapshot.payloadHash,
            schemaVersion: snapshot.schemaVersion,
        },
        plan: excludeBookmarkStorageKeyConflicts(buildCloudBackupRestorePlan({
            localBookmarks,
            remoteBookmarks: parse.bookmarks,
            strategy,
        }), storedKeys),
        library: library?.counts ?? null,
    };
}

async function applyRestore(snapshotId: string, strategy: 'previewOnly' | 'safeMerge' | 'replaceLocal', expectedPayloadHash: string) {
    if (strategy === 'previewOnly') {
        throw new CloudBackupProviderError('INVALID_REQUEST', 'Preview cannot be applied');
    }
    const snapshot = await validateCloudBackupSnapshot(await providerFactory().downloadSnapshot(snapshotId));
    if (snapshot.snapshotId !== snapshotId || snapshot.payloadHash !== expectedPayloadHash) {
        throw new CloudBackupProviderError('CONFLICT', 'Backup changed since preview. Preview it again before restoring.');
    }
    if (snapshot.schemaVersion === 3) {
        return backgroundStorageQueue.enqueue(async () => ({
            ...await applyLibraryExport({
                remote: snapshot.payload, readers: libraryReaders, now: Date.now(), strategy,
                sourceSnapshotId: snapshot.snapshotId, quotaBytes: getQuotaBytesFallback(),
            }),
            snapshotVersion: 3,
        }));
    }
    const sourceBookmarks = bookmarkPayload(snapshot);
    const parse = parseImportData(sourceBookmarks);
    return backgroundStorageQueue.enqueue(async () => {
        const now = Date.now();
        const existingIndex = await bookmarksIndexStore.buildIndexIfMissing(now);
        const storedKeys = await storedBookmarkKeys();
        if (strategy === 'replaceLocal') requireCompleteBookmarkIndex(existingIndex, storedKeys);
        const localBookmarks = await loadAllBookmarksForBackground(now);
        if (strategy === 'replaceLocal' && localBookmarks.length !== existingIndex.length) throw new Error('SNAPSHOT_CORRUPTED');
        const restorePlan = excludeBookmarkStorageKeyConflicts(buildCloudBackupRestorePlan({
            localBookmarks,
            remoteBookmarks: parse.bookmarks,
            strategy,
        }), storedKeys);
        const emergencyPayload = exportBookmarks({ bookmarks: localBookmarks, preserveStructure: true }).payload;
        const emergencySnapshot = await createCloudBackupSnapshot(emergencyPayload);
        const emergencySnapshotKey = `aimd:cloud_backup:emergency_restore:googleDrive:v1:${now}`;
        const emergencyRecord = { createdAt: new Date(now).toISOString(), sourceSnapshotId: snapshot.snapshotId, snapshot: emergencySnapshot };
        const usedBytes = await localStoragePort.getBytesInUse(null);
        const importPlan = planImportBookmarks({
            jsonText: JSON.stringify({
                ...sourceBookmarks,
                bookmarks: restorePlan.bookmarksToUpsert,
            }),
            existing: strategy === 'replaceLocal' ? [] : localBookmarks,
            existingIndex: strategy === 'replaceLocal' ? [] : existingIndex,
            now,
            usedBytes,
            quotaBytes: getQuotaBytesFallback(),
            saveContextOnly: false,
        });
        if (!importPlan.quota.canImport) {
            throw new CloudBackupProviderError('QUOTA_EXCEEDED', importPlan.quota.message || 'Not enough storage space for Google Drive restore');
        }

        const { folderPaths, folders } = await loadAllFoldersForBackground();
        const ensure = await ensureFolderRecordsExistForBackground({
            requiredPaths: importPlan.foldersToEnsure,
            folderPaths,
            folders,
            now,
        });

        let bookmarksToUpsert = importPlan.bookmarksToUpsert;
        if (ensure.failedPaths.length > 0) {
            const failedPrefixes = ensure.failedPaths.map((p) => `${p}/`);
            bookmarksToUpsert = bookmarksToUpsert.map((bookmark) => {
                const affected = ensure.failedPaths.includes(bookmark.folderPath)
                    || failedPrefixes.some((prefix) => bookmark.folderPath.startsWith(prefix));
                return affected
                    ? rememberBookmarkStorageKey({ ...bookmark, folderPath: 'Import' }, buildBookmarkStorageKeyForBookmark(bookmark))
                    : bookmark;
            });
        }

        const bookmarkPatch: Record<string, unknown> = {};
        for (const bookmark of bookmarksToUpsert) {
            bookmarkPatch[buildBookmarkStorageKeyForBookmark(bookmark)] = bookmark;
        }
        const nextBookmarkKeys = new Set(Object.keys(bookmarkPatch));
        const staleKeys = strategy === 'replaceLocal' ? existingIndex.filter(key => !nextBookmarkKeys.has(key)) : [];
        const patch = {
            ...ensure.folderSetPatch,
            [LEGACY_STORAGE_KEYS.folderPathsIndex]: ensure.updatedFolderPaths,
            ...bookmarkPatch,
            [STORAGE_KEYS.bookmarksIndexV1]: importPlan.updatedIndex,
        };
        const additionalBytes = new TextEncoder().encode(JSON.stringify({ [emergencySnapshotKey]: emergencyRecord, ...patch })).byteLength;
        if (usedBytes + additionalBytes > getQuotaBytesFallback()) {
            throw new CloudBackupProviderError('QUOTA_EXCEEDED', 'Not enough local storage for a recoverable Google Drive restore');
        }

        await saveVerifiedEmergencySnapshot(emergencySnapshotKey, emergencyRecord);
        await localStoragePort.set(patch);
        if (staleKeys.length) await localStoragePort.remove(staleKeys);

        return {
            restored: bookmarksToUpsert.length,
            skippedDuplicates: restorePlan.duplicateCount,
            conflicts: restorePlan.conflictCount,
            localOnly: restorePlan.localOnlyCount,
            emergencySnapshotKey,
            folderCreateFailures: ensure.failedPaths.length,
            library: null,
            snapshotVersion: snapshot.schemaVersion,
        };
    });
}

export async function handleCloudBackupRequest(request: ExtRequest): Promise<HandlerResult | null> {
    if (!request.type.startsWith('cloudBackup:')) return null;
    const payload = 'payload' in request ? request.payload as { provider?: string; snapshotId?: string; strategy?: 'previewOnly' | 'safeMerge' | 'replaceLocal'; payloadHash?: string } : null;
    if (payload?.provider !== 'googleDrive') {
        return { response: err(request.id, request.type, 'PROVIDER_UNAVAILABLE', 'Only Google Drive backup is enabled for this validation build') };
    }

    try {
        switch (request.type) {
            case 'cloudBackup:status':
                return { response: ok(request.id, request.type, await readCloudBackupStatus()) };
            case 'cloudBackup:diagnostics': {
                const diagnostics = providerFactory().getDiagnostics?.();
                if (!diagnostics) {
                    throw new CloudBackupProviderError('PROVIDER_UNAVAILABLE', 'Google Drive backup diagnostics are unavailable in this build');
                }
                return { response: ok(request.id, request.type, diagnostics) };
            }
            case 'cloudBackup:connect': {
                await writeStatus({ ...(await readStatus()), connected: false, lastError: null });
                const result = await providerFactory().connect();
                const connectedAt = new Date().toISOString();
                const connectedAccount: CloudBackupConnectedAccount = {
                    accountEmail: result.accountEmail ?? null,
                    accountDisplayName: result.accountDisplayName ?? null,
                    accountPhotoUrl: result.accountPhotoUrl ?? null,
                    connectedAt,
                };
                await writeStatus({
                    connected: true,
                    connectedAt,
                    connectedAccount,
                    sessionState: providerFactory().getSessionState?.() ?? 'readyInThisSession',
                    lastVerifiedAt: connectedAt,
                    lastError: null,
                    ...result,
                });
                return { response: ok(request.id, request.type, await readStatus()) };
            }
            case 'cloudBackup:disconnect':
                await providerFactory().disconnect();
                await writeStatus({
                    connected: false,
                    connectedAccount: null,
                    sessionState: 'unknown',
                    lastError: null,
                    accountEmail: null,
                    accountDisplayName: null,
                    accountPhotoUrl: null,
                });
                return { response: ok(request.id, request.type, await readStatus()) };
            case 'cloudBackup:backupNow':
                return { response: ok(request.id, request.type, await cloudBackupQueue.run(backupNow)) };
            case 'cloudBackup:listSnapshots':
                return { response: ok(request.id, request.type, { snapshots: await cloudBackupQueue.run(() => providerFactory().listSnapshots()) }) };
            case 'cloudBackup:previewRestore':
                return { response: ok(request.id, request.type, await cloudBackupQueue.run(() => previewRestore(payload.snapshotId ?? '', payload.strategy ?? 'safeMerge'))) };
            case 'cloudBackup:applyRestore':
                if (typeof payload.payloadHash !== 'string' || !/^sha256:[0-9a-f]{64}$/.test(payload.payloadHash)) {
                    return { response: err(request.id, request.type, 'INVALID_REQUEST', 'Preview this backup before applying it') };
                }
                return { response: ok(request.id, request.type, await cloudBackupQueue.run(() => applyRestore(payload.snapshotId ?? '', payload.strategy ?? 'safeMerge', payload.payloadHash!))) };
            case 'cloudBackup:deleteSnapshot':
                await cloudBackupQueue.run(() => providerFactory().deleteSnapshot(payload.snapshotId ?? ''));
                return { response: ok(request.id, request.type, { trashed: true }) };
            default:
                return null;
        }
    } catch (error) {
        const mapped = mapError(error);
        await writeStatus({ ...(await readStatus()), sessionState: 'error', lastError: mapped.message });
        return { response: err(request.id, request.type, mapped.code, mapped.message) };
    }
}
