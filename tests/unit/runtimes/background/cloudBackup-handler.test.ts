import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ExtRequest } from '../../../../src/contracts/protocol';
import type { CloudBackupProvider } from '../../../../src/drivers/background/cloudBackup/provider';
import type { CloudBackupSnapshot } from '../../../../src/core/cloudBackup/types';

type StorageMap = Record<string, any>;

function createInMemoryBrowser(store: StorageMap) {
    const local = {
        get: vi.fn(async (keys?: null | string | string[] | Record<string, any>) => {
            if (keys === null || keys === undefined) return { ...store };
            if (typeof keys === 'string') return { [keys]: store[keys] };
            if (Array.isArray(keys)) {
                const result: Record<string, any> = {};
                for (const k of keys) if (Object.prototype.hasOwnProperty.call(store, k)) result[k] = store[k];
                return result;
            }
            const result: Record<string, any> = {};
            for (const [k, fallback] of Object.entries(keys)) {
                result[k] = Object.prototype.hasOwnProperty.call(store, k) ? store[k] : fallback;
            }
            return result;
        }),
        set: vi.fn(async (patch: Record<string, any>) => {
            Object.assign(store, patch);
        }),
        remove: vi.fn(async (keys: string | string[]) => {
            const list = Array.isArray(keys) ? keys : [keys];
            for (const k of list) delete store[k];
        }),
        getBytesInUse: vi.fn(async () => JSON.stringify(store).length),
    };

    return {
        runtime: { getManifest: () => ({ version: '4.3.1', manifest_version: 3 }) },
        storage: { local, sync: local },
    };
}

function req<T extends ExtRequest['type']>(type: T, payload?: any): Extract<ExtRequest, { type: T }> {
    return { v: 1, id: `t_${type}`, type, payload } as any;
}

function bookmark(position: number, title = `T${position}`) {
    return {
        url: `https://chatgpt.com/c/${position}`,
        urlWithoutProtocol: `chatgpt.com/c/${position}`,
        position,
        messageId: null,
        userMessage: `u${position}`,
        aiResponse: `a${position}`,
        timestamp: position,
        title,
        platform: 'ChatGPT',
        folderPath: 'Import',
    };
}

const markDocument = { platform: 'chatgpt' as const, conversationId: 'sample', title: 'Sample' };
const markRecord = {
    id: 'mark-1', itemId: 'item-1', target: { assistantMessageId: 'assistant-1' }, quoteText: 'quote', sourceMarkdown: 'quote',
    selectors: { textQuote: { exact: 'quote', prefix: '', suffix: '' }, textPosition: { start: 0, end: 5 }, domRange: null, atomicRefs: [] },
    createdAt: 1, updatedAt: 1, revision: 1,
};
const highlightKey = 'aimd:highlights:document:v1:chatgpt:conversation:sample';
const annotationKey = 'aimd:reader_annotations:document:chatgpt:conversation:sample';
const catalogKey = 'aimd:mark_library:catalog:v1';
function markStores(): StorageMap {
    return {
        [highlightKey]: { schemaVersion: 1, document: markDocument, highlights: [{ ...markRecord, color: 'blue' }] },
        [annotationKey]: { schemaVersion: 1, document: markDocument, annotations: [{ ...markRecord, comment: 'Note', lastKnownAnchorState: 'anchored' }] },
        [catalogKey]: { schemaVersion: 1, revision: 1, folders: [{ id: 'saved', parentId: null, name: 'Saved', createdAt: 1, updatedAt: 1 }], conversations: [{ document: markDocument, folderId: 'saved', customTitle: 'Research', updatedAt: 1 }] },
    };
}

function snapshotProvider(snapshot: CloudBackupSnapshot): CloudBackupProvider {
    return {
        connect: vi.fn(), disconnect: vi.fn(), uploadSnapshot: vi.fn(),
        listSnapshots: vi.fn(async () => []), downloadSnapshot: vi.fn(async () => snapshot), deleteSnapshot: vi.fn(),
    };
}

describe('background cloud backup handler', () => {
    beforeEach(() => {
        vi.resetModules();
        vi.clearAllMocks();
        delete (globalThis as any).browser;
        delete (globalThis as any).chrome;
    });

    it('backs up a consistent bookmarks snapshot through the selected provider', async () => {
        const store: StorageMap = {
            'bookmark:chatgpt.com/c/1:1': bookmark(1),
            'aimd:bookmarks:index:v1': ['bookmark:chatgpt.com/c/1:1'],
        };
        (globalThis as any).browser = createInMemoryBrowser(store);
        const uploads: CloudBackupSnapshot[] = [];
        const provider: CloudBackupProvider = {
            connect: vi.fn(),
            disconnect: vi.fn(),
            uploadSnapshot: vi.fn(async (snapshot) => {
                uploads.push(snapshot);
                return { snapshotId: snapshot.snapshotId, name: 'remote-1.json', size: 1, createdAt: snapshot.createdAt };
            }),
            listSnapshots: vi.fn(async () => []),
            downloadSnapshot: vi.fn(),
            deleteSnapshot: vi.fn(),
        };

        const mod = await import('../../../../src/runtimes/background/handlers/cloudBackup');
        mod.setCloudBackupProviderFactoryForTests(() => provider);

        const res = await mod.handleCloudBackupRequest(req('cloudBackup:backupNow', { provider: 'googleDrive' }));

        expect(res?.response.ok).toBe(true);
        expect(uploads).toHaveLength(1);
        expect(uploads[0]!.schemaVersion).toBe(3);
        if (uploads[0]!.schemaVersion !== 3) throw new Error('Expected Library snapshot');
        expect(uploads[0]!.payload.bookmarks).toHaveLength(1);
        expect(uploads[0]!.payloadHash).toMatch(/^sha256:/);
    });

    it('includes durable marks, organization and empty bookmark folders in the new snapshot', async () => {
        const store: StorageMap = {
            ...markStores(),
            'bookmark:chatgpt.com/c/1:1': bookmark(1),
            'aimd:bookmarks:index:v1': ['bookmark:chatgpt.com/c/1:1'],
            'folder:Empty': { path: 'Empty', name: 'Empty', depth: 1, createdAt: 1, updatedAt: 1 },
            folderPaths: ['Empty'],
        };
        // The folder index uses a legacy key; keep the test independent of its spelling.
        const { LEGACY_STORAGE_KEYS } = await import('../../../../src/contracts/storage');
        store[LEGACY_STORAGE_KEYS.folderPathsIndex] = ['Empty'];
        delete store.folderPaths;
        (globalThis as any).browser = createInMemoryBrowser(store);
        const uploads: CloudBackupSnapshot[] = [];
        const provider: CloudBackupProvider = {
            connect: vi.fn(), disconnect: vi.fn(), listSnapshots: vi.fn(async () => []), downloadSnapshot: vi.fn(), deleteSnapshot: vi.fn(),
            uploadSnapshot: vi.fn(async snapshot => { uploads.push(snapshot); return { snapshotId: snapshot.snapshotId, name: 'backup.json', size: 1, createdAt: snapshot.createdAt }; }),
        };
        const mod = await import('../../../../src/runtimes/background/handlers/cloudBackup');
        mod.setCloudBackupProviderFactoryForTests(() => provider);

        const result = await mod.handleCloudBackupRequest(req('cloudBackup:backupNow', { provider: 'googleDrive' }));

        expect(result?.response.ok).toBe(true);
        const snapshot = uploads[0]!;
        if (snapshot.schemaVersion !== 3) throw new Error('Expected Library snapshot');
        expect(snapshot.payload.bookmarkFolders).toEqual(['Empty']);
        expect(snapshot.payload.highlights[0]!.highlights).toHaveLength(1);
        expect(snapshot.payload.annotations[0]!.annotations).toHaveLength(1);
        expect(snapshot.payload.markCatalog.conversations[0]!.customTitle).toBe('Research');
    });

    it('refuses to upload an incomplete snapshot when a durable bundle is corrupt', async () => {
        const store: StorageMap = { ...markStores(), [annotationKey]: { broken: true } };
        (globalThis as any).browser = createInMemoryBrowser(store);
        const provider: CloudBackupProvider = { ...snapshotProvider({} as CloudBackupSnapshot), uploadSnapshot: vi.fn() };
        const mod = await import('../../../../src/runtimes/background/handlers/cloudBackup');
        mod.setCloudBackupProviderFactoryForTests(() => provider);

        const result = await mod.handleCloudBackupRequest(req('cloudBackup:backupNow', { provider: 'googleDrive' }));

        expect(result?.response).toMatchObject({ ok: false, error: { code: 'SNAPSHOT_CORRUPTED' } });
        expect(provider.uploadSnapshot).not.toHaveBeenCalled();
    });

    it('does not treat a null folder catalog as an empty catalog during backup', async () => {
        const store: StorageMap = { ...markStores(), [catalogKey]: null };
        (globalThis as any).browser = createInMemoryBrowser(store);
        const provider: CloudBackupProvider = { ...snapshotProvider({} as CloudBackupSnapshot), uploadSnapshot: vi.fn() };
        const mod = await import('../../../../src/runtimes/background/handlers/cloudBackup');
        mod.setCloudBackupProviderFactoryForTests(() => provider);

        const result = await mod.handleCloudBackupRequest(req('cloudBackup:backupNow', { provider: 'googleDrive' }));

        expect(result?.response).toMatchObject({ ok: false, error: { code: 'SNAPSHOT_CORRUPTED' } });
        expect(provider.uploadSnapshot).not.toHaveBeenCalled();
    });

    it('safe-merges new marks and folders while retaining local mark conflicts', async () => {
        const localMarks = markStores();
        const store: StorageMap = { ...localMarks, 'bookmark:chatgpt.com/c/1:1': bookmark(1), 'aimd:bookmarks:index:v1': ['bookmark:chatgpt.com/c/1:1'] };
        (globalThis as any).browser = createInMemoryBrowser(store);
        const { buildExportPayload } = await import('../../../../src/core/bookmarks/importExport');
        const { createLibraryCloudBackupSnapshot } = await import('../../../../src/core/cloudBackup/snapshot');
        const remoteMarks = markStores();
        remoteMarks[highlightKey].highlights.push({ ...markRecord, id: 'mark-2', color: 'red' });
        remoteMarks[highlightKey].highlights[0].color = 'yellow';
        remoteMarks[annotationKey].annotations.push({ ...markRecord, id: 'note-2', comment: 'Remote note', lastKnownAnchorState: 'anchored' });
        remoteMarks[catalogKey].folders.push({ id: 'remote', parentId: null, name: 'Remote', createdAt: 2, updatedAt: 2 });
        const snapshot = await createLibraryCloudBackupSnapshot({
            version: '4.0', exportDate: new Date().toISOString(),
            bookmarks: buildExportPayload([bookmark(2)], true).bookmarks, bookmarkFolders: ['Archive', 'Empty'],
            highlights: [remoteMarks[highlightKey]], annotations: [remoteMarks[annotationKey]], markCatalog: remoteMarks[catalogKey],
        });
        const mod = await import('../../../../src/runtimes/background/handlers/cloudBackup');
        mod.setCloudBackupProviderFactoryForTests(() => snapshotProvider(snapshot));

        const preview = await mod.handleCloudBackupRequest(req('cloudBackup:previewRestore', { provider: 'googleDrive', snapshotId: snapshot.snapshotId, strategy: 'safeMerge' }));
        expect((preview as any).response.data.library).toMatchObject({ highlights: { added: 1, conflict: 1 }, annotations: { added: 1 }, folders: { added: 1 } });
        const result = await mod.handleCloudBackupRequest(req('cloudBackup:applyRestore', { provider: 'googleDrive', snapshotId: snapshot.snapshotId, strategy: 'safeMerge', payloadHash: snapshot.payloadHash }));

        expect(result?.response.ok).toBe(true);
        expect(store[highlightKey].highlights).toHaveLength(2);
        expect(store[highlightKey].highlights[0].color).toBe('blue');
        expect(store[annotationKey].annotations).toHaveLength(2);
        expect(store[catalogKey].folders).toHaveLength(2);
        expect(store[catalogKey].conversations[0].customTitle).toBe('Research');
        expect(store['bookmark:chatgpt.com/c/1:1']).toBeDefined();
        expect(store['bookmark:chatgpt.com/c/2:2']).toBeDefined();
        const { LEGACY_STORAGE_KEYS } = await import('../../../../src/contracts/storage');
        expect(store[LEGACY_STORAGE_KEYS.folderPathsIndex]).toContain('Empty');
        expect(Object.keys(store).some(key => key.startsWith('aimd:cloud_backup:emergency_restore:'))).toBe(false);
    });

    it('replaces all Library domains only for a version 3 snapshot and keeps a complete emergency copy', async () => {
        const { LEGACY_STORAGE_KEYS } = await import('../../../../src/contracts/storage');
        const store: StorageMap = { ...markStores(), 'bookmark:chatgpt.com/c/1:1': bookmark(1), 'aimd:bookmarks:index:v1': ['bookmark:chatgpt.com/c/1:1'],
            [LEGACY_STORAGE_KEYS.folderPathsIndex]: ['OldFolder'], [LEGACY_STORAGE_KEYS.lastSelectedFolderPath]: 'OldFolder',
            'folder:OldFolder': { path: 'OldFolder', name: 'OldFolder', depth: 1, createdAt: 1, updatedAt: 1 } };
        (globalThis as any).browser = createInMemoryBrowser(store);
        const { buildExportPayload } = await import('../../../../src/core/bookmarks/importExport');
        const { createLibraryCloudBackupSnapshot } = await import('../../../../src/core/cloudBackup/snapshot');
        const snapshot = await createLibraryCloudBackupSnapshot({ version: '4.0', exportDate: new Date().toISOString(), bookmarks: buildExportPayload([bookmark(2)], true).bookmarks, bookmarkFolders: [], highlights: [], annotations: [], markCatalog: { schemaVersion: 1, revision: 0, folders: [], conversations: [] } });
        const mod = await import('../../../../src/runtimes/background/handlers/cloudBackup');
        mod.setCloudBackupProviderFactoryForTests(() => snapshotProvider(snapshot));

        const result = await mod.handleCloudBackupRequest(req('cloudBackup:applyRestore', { provider: 'googleDrive', snapshotId: snapshot.snapshotId, strategy: 'replaceLocal', payloadHash: snapshot.payloadHash }));

        expect(result?.response.ok).toBe(true);
        expect(store[highlightKey]).toBeUndefined();
        expect(store[annotationKey]).toBeUndefined();
        expect(store[catalogKey].folders).toHaveLength(0);
        expect(store['folder:OldFolder']).toBeUndefined();
        expect(store[LEGACY_STORAGE_KEYS.lastSelectedFolderPath]).toBeUndefined();
        const emergency = Object.entries(store).find(([key]) => key.startsWith('aimd:cloud_backup:emergency_restore:googleDrive:v1:'))?.[1];
        expect(emergency.snapshot.payload.highlights).toHaveLength(1);
        expect(emergency.snapshot.payload.annotations).toHaveLength(1);
        expect(emergency.snapshot.payload.markCatalog.folders).toHaveLength(1);
    });

    it('keeps old Library data and its emergency copy when a replacement write fails', async () => {
        const store: StorageMap = { ...markStores(), 'bookmark:chatgpt.com/c/1:1': bookmark(1), 'aimd:bookmarks:index:v1': ['bookmark:chatgpt.com/c/1:1'] };
        const browser = createInMemoryBrowser(store);
        const write = browser.storage.local.set.getMockImplementation()!;
        browser.storage.local.set.mockImplementation(async patch => {
            if (patch[catalogKey] && patch['aimd:bookmarks:index:v1']) throw new Error('Simulated write failure');
            return write(patch);
        });
        (globalThis as any).browser = browser;
        const { buildExportPayload } = await import('../../../../src/core/bookmarks/importExport');
        const { createLibraryCloudBackupSnapshot } = await import('../../../../src/core/cloudBackup/snapshot');
        const snapshot = await createLibraryCloudBackupSnapshot({ version: '4.0', exportDate: new Date().toISOString(), bookmarks: buildExportPayload([bookmark(2)], true).bookmarks, bookmarkFolders: [], highlights: [], annotations: [], markCatalog: { schemaVersion: 1, revision: 0, folders: [], conversations: [] } });
        const mod = await import('../../../../src/runtimes/background/handlers/cloudBackup');
        mod.setCloudBackupProviderFactoryForTests(() => snapshotProvider(snapshot));

        const result = await mod.handleCloudBackupRequest(req('cloudBackup:applyRestore', { provider: 'googleDrive', snapshotId: snapshot.snapshotId, strategy: 'replaceLocal', payloadHash: snapshot.payloadHash }));

        expect(result?.response.ok).toBe(false);
        expect(store['bookmark:chatgpt.com/c/1:1']).toBeDefined();
        expect(store[highlightKey]).toBeDefined();
        expect(store[annotationKey]).toBeDefined();
        expect(Object.keys(store).some(key => key.startsWith('aimd:cloud_backup:emergency_restore:'))).toBe(true);
    });

    it('does not replace Library data when the emergency copy is silently not stored', async () => {
        const store: StorageMap = { ...markStores(), 'bookmark:chatgpt.com/c/1:1': bookmark(1), 'aimd:bookmarks:index:v1': ['bookmark:chatgpt.com/c/1:1'] };
        const browser = createInMemoryBrowser(store);
        const write = browser.storage.local.set.getMockImplementation()!;
        browser.storage.local.set.mockImplementation(async patch => {
            if (Object.keys(patch).some(key => key.startsWith('aimd:cloud_backup:emergency_restore:'))) return;
            return write(patch);
        });
        (globalThis as any).browser = browser;
        const { buildExportPayload } = await import('../../../../src/core/bookmarks/importExport');
        const { createLibraryCloudBackupSnapshot } = await import('../../../../src/core/cloudBackup/snapshot');
        const snapshot = await createLibraryCloudBackupSnapshot({ version: '4.0', exportDate: new Date().toISOString(), bookmarks: buildExportPayload([bookmark(2)], true).bookmarks, bookmarkFolders: [], highlights: [], annotations: [], markCatalog: { schemaVersion: 1, revision: 0, folders: [], conversations: [] } });
        const mod = await import('../../../../src/runtimes/background/handlers/cloudBackup');
        mod.setCloudBackupProviderFactoryForTests(() => snapshotProvider(snapshot));

        const result = await mod.handleCloudBackupRequest(req('cloudBackup:applyRestore', { provider: 'googleDrive', snapshotId: snapshot.snapshotId, strategy: 'replaceLocal', payloadHash: snapshot.payloadHash }));

        expect(result?.response.ok).toBe(false);
        expect(store['bookmark:chatgpt.com/c/1:1']).toBeDefined();
        expect(store[highlightKey]).toBeDefined();
        expect(store[annotationKey]).toBeDefined();
    });

    it('does not replace bookmarks from an older cloud file without a verified emergency copy', async () => {
        const store: StorageMap = { 'bookmark:chatgpt.com/c/1:1': bookmark(1), 'aimd:bookmarks:index:v1': ['bookmark:chatgpt.com/c/1:1'] };
        const browser = createInMemoryBrowser(store);
        const write = browser.storage.local.set.getMockImplementation()!;
        browser.storage.local.set.mockImplementation(async patch => {
            if (Object.keys(patch).some(key => key.startsWith('aimd:cloud_backup:emergency_restore:'))) return;
            return write(patch);
        });
        (globalThis as any).browser = browser;
        const { buildExportPayload } = await import('../../../../src/core/bookmarks/importExport');
        const { createCloudBackupSnapshot } = await import('../../../../src/core/cloudBackup/snapshot');
        const snapshot = await createCloudBackupSnapshot(buildExportPayload([bookmark(2)], true));
        const mod = await import('../../../../src/runtimes/background/handlers/cloudBackup');
        mod.setCloudBackupProviderFactoryForTests(() => snapshotProvider(snapshot));

        const result = await mod.handleCloudBackupRequest(req('cloudBackup:applyRestore', { provider: 'googleDrive', snapshotId: snapshot.snapshotId, strategy: 'replaceLocal', payloadHash: snapshot.payloadHash }));

        expect(result?.response.ok).toBe(false);
        expect(store['bookmark:chatgpt.com/c/1:1']).toBeDefined();
        expect(store['bookmark:chatgpt.com/c/2:2']).toBeUndefined();
    });

    it('does not overwrite a bookmark omitted from a partial index during older cloud safe merge', async () => {
        const key = 'bookmark:chatgpt.com/c/1:1';
        const local = { ...bookmark(1, 'Local'), messageId: 'assistant-local' };
        const store: StorageMap = { [key]: local, 'aimd:bookmarks:index:v1': [] };
        (globalThis as any).browser = createInMemoryBrowser(store);
        const { buildExportPayload } = await import('../../../../src/core/bookmarks/importExport');
        const { createCloudBackupSnapshot } = await import('../../../../src/core/cloudBackup/snapshot');
        const snapshot = await createCloudBackupSnapshot(buildExportPayload([{ ...bookmark(1, 'Remote'), messageId: null }], true));
        const mod = await import('../../../../src/runtimes/background/handlers/cloudBackup');
        mod.setCloudBackupProviderFactoryForTests(() => snapshotProvider(snapshot));

        const result = await mod.handleCloudBackupRequest(req('cloudBackup:applyRestore', { provider: 'googleDrive', snapshotId: snapshot.snapshotId, strategy: 'safeMerge', payloadHash: snapshot.payloadHash }));

        expect(result?.response.ok).toBe(true);
        expect(store[key]).toEqual(local);
        expect((result as any).response.data.conflicts).toBeGreaterThan(0);
    });

    it('refuses older cloud replacement when its emergency copy would omit an unindexed bookmark', async () => {
        const key = 'bookmark:chatgpt.com/c/1:1';
        const local = bookmark(1, 'Local');
        const store: StorageMap = { [key]: local, 'aimd:bookmarks:index:v1': [] };
        (globalThis as any).browser = createInMemoryBrowser(store);
        const { buildExportPayload } = await import('../../../../src/core/bookmarks/importExport');
        const { createCloudBackupSnapshot } = await import('../../../../src/core/cloudBackup/snapshot');
        const snapshot = await createCloudBackupSnapshot(buildExportPayload([bookmark(2, 'Remote')], true));
        const mod = await import('../../../../src/runtimes/background/handlers/cloudBackup');
        mod.setCloudBackupProviderFactoryForTests(() => snapshotProvider(snapshot));

        const result = await mod.handleCloudBackupRequest(req('cloudBackup:applyRestore', { provider: 'googleDrive', snapshotId: snapshot.snapshotId, strategy: 'replaceLocal', payloadHash: snapshot.payloadHash }));

        expect(result?.response.ok).toBe(false);
        expect(store[key]).toEqual(local);
    });

    it('refuses older cloud replacement when an indexed bookmark cannot enter its emergency copy', async () => {
        const key = 'bookmark:chatgpt.com/c/1:1';
        const store: StorageMap = { [key]: 'unreadable', 'aimd:bookmarks:index:v1': [key] };
        (globalThis as any).browser = createInMemoryBrowser(store);
        const { buildExportPayload } = await import('../../../../src/core/bookmarks/importExport');
        const { createCloudBackupSnapshot } = await import('../../../../src/core/cloudBackup/snapshot');
        const snapshot = await createCloudBackupSnapshot(buildExportPayload([bookmark(1, 'Remote')], true));
        const mod = await import('../../../../src/runtimes/background/handlers/cloudBackup');
        mod.setCloudBackupProviderFactoryForTests(() => snapshotProvider(snapshot));

        const result = await mod.handleCloudBackupRequest(req('cloudBackup:applyRestore', { provider: 'googleDrive', snapshotId: snapshot.snapshotId, strategy: 'replaceLocal', payloadHash: snapshot.payloadHash }));

        expect(result?.response.ok).toBe(false);
        expect(store[key]).toBe('unreadable');
    });

    it('rejects a Library restore that cannot fit before writing any new records', async () => {
        const store: StorageMap = { ...markStores() };
        const browser = createInMemoryBrowser(store);
        browser.storage.local.getBytesInUse.mockResolvedValue(10 * 1024 * 1024);
        (globalThis as any).browser = browser;
        const { buildExportPayload } = await import('../../../../src/core/bookmarks/importExport');
        const { createLibraryCloudBackupSnapshot } = await import('../../../../src/core/cloudBackup/snapshot');
        const snapshot = await createLibraryCloudBackupSnapshot({ version: '4.0', exportDate: new Date().toISOString(), bookmarks: buildExportPayload([bookmark(2)], true).bookmarks, bookmarkFolders: [], highlights: [], annotations: [], markCatalog: { schemaVersion: 1, revision: 0, folders: [], conversations: [] } });
        const mod = await import('../../../../src/runtimes/background/handlers/cloudBackup');
        mod.setCloudBackupProviderFactoryForTests(() => snapshotProvider(snapshot));

        const result = await mod.handleCloudBackupRequest(req('cloudBackup:applyRestore', { provider: 'googleDrive', snapshotId: snapshot.snapshotId, strategy: 'safeMerge', payloadHash: snapshot.payloadHash }));

        expect(result?.response).toMatchObject({ ok: false, error: { code: 'QUOTA_EXCEEDED' } });
        expect(store[highlightKey].highlights).toHaveLength(1);
        expect(Object.keys(store).some(key => key.startsWith('bookmark:'))).toBe(false);
    });

    it('preserves the connected account summary when backup succeeds', async () => {
        const store: StorageMap = {
            'bookmark:chatgpt.com/c/1:1': bookmark(1),
            'aimd:bookmarks:index:v1': ['bookmark:chatgpt.com/c/1:1'],
            'aimd:cloud_backup:status:googleDrive:v1': {
                connected: true,
                accountEmail: 'zhaoliangbin42@gmail.com',
                accountDisplayName: 'Liangbin Zhao',
                accountPhotoUrl: 'https://lh3.googleusercontent.com/avatar',
                authStrategy: 'webExtensionAccessToken',
            },
        };
        (globalThis as any).browser = createInMemoryBrowser(store);
        const provider: CloudBackupProvider = {
            connect: vi.fn(),
            disconnect: vi.fn(),
            uploadSnapshot: vi.fn(async (snapshot) => ({
                snapshotId: snapshot.snapshotId,
                name: 'remote-1.json',
                size: 1,
                createdAt: snapshot.createdAt,
            })),
            listSnapshots: vi.fn(async () => []),
            downloadSnapshot: vi.fn(),
            deleteSnapshot: vi.fn(),
        };

        const mod = await import('../../../../src/runtimes/background/handlers/cloudBackup');
        mod.setCloudBackupProviderFactoryForTests(() => provider);

        await mod.handleCloudBackupRequest(req('cloudBackup:backupNow', { provider: 'googleDrive' }));

        expect(store['aimd:cloud_backup:status:googleDrive:v1']).toMatchObject({
            connected: true,
            accountEmail: 'zhaoliangbin42@gmail.com',
            accountDisplayName: 'Liangbin Zhao',
            accountPhotoUrl: 'https://lh3.googleusercontent.com/avatar',
            authStrategy: 'webExtensionAccessToken',
            sessionState: 'readyInThisSession',
            lastVerifiedAt: expect.any(String),
            lastSnapshotId: expect.any(String),
            lastError: null,
        });
    });

    it('previews a restore without mutating local bookmarks', async () => {
        const store: StorageMap = {
            'bookmark:chatgpt.com/c/1:1': bookmark(1, 'Local'),
            'aimd:bookmarks:index:v1': ['bookmark:chatgpt.com/c/1:1'],
        };
        (globalThis as any).browser = createInMemoryBrowser(store);

        const { createCloudBackupSnapshot } = await import('../../../../src/core/cloudBackup/snapshot');
        const { buildExportPayload } = await import('../../../../src/core/bookmarks/importExport');
        const snapshot = await createCloudBackupSnapshot(buildExportPayload([bookmark(1, 'Remote'), bookmark(2, 'Remote Only')], true), new Date(0));
        const provider: CloudBackupProvider = {
            connect: vi.fn(),
            disconnect: vi.fn(),
            uploadSnapshot: vi.fn(),
            listSnapshots: vi.fn(async () => []),
            downloadSnapshot: vi.fn(async () => snapshot),
            deleteSnapshot: vi.fn(),
        };

        const mod = await import('../../../../src/runtimes/background/handlers/cloudBackup');
        mod.setCloudBackupProviderFactoryForTests(() => provider);

        const res = await mod.handleCloudBackupRequest(req('cloudBackup:previewRestore', {
            provider: 'googleDrive',
            snapshotId: snapshot.snapshotId,
            strategy: 'safeMerge',
        }));

        expect(res?.response.ok).toBe(true);
        expect((res as any).response.data.plan).toMatchObject({ conflictCount: 1, localOnlyCount: 0 });
        expect((res as any).response.data.plan.bookmarksToUpsert).toHaveLength(1);
        expect(store['bookmark:chatgpt.com/c/2:2']).toBeUndefined();
        expect(store['bookmark:chatgpt.com/c/1:1'].title).toBe('Local');
    });

    it('refuses apply when the Drive file changes after the user previews it', async () => {
        const store: StorageMap = {};
        (globalThis as any).browser = createInMemoryBrowser(store);
        const { createLibraryCloudBackupSnapshot } = await import('../../../../src/core/cloudBackup/snapshot');
        const { buildExportPayload } = await import('../../../../src/core/bookmarks/importExport');
        const payload = (position: number) => ({ version: '4.0' as const, exportDate: new Date().toISOString(), bookmarks: buildExportPayload([bookmark(position)], true).bookmarks, bookmarkFolders: [], highlights: [], annotations: [], markCatalog: { schemaVersion: 1 as const, revision: 0, folders: [], conversations: [] } });
        const before = await createLibraryCloudBackupSnapshot(payload(1));
        const after = await createLibraryCloudBackupSnapshot(payload(2));
        after.snapshotId = before.snapshotId;
        const provider = snapshotProvider(before);
        vi.mocked(provider.downloadSnapshot).mockResolvedValueOnce(before).mockResolvedValueOnce(after);
        const mod = await import('../../../../src/runtimes/background/handlers/cloudBackup');
        mod.setCloudBackupProviderFactoryForTests(() => provider);

        const preview = await mod.handleCloudBackupRequest(req('cloudBackup:previewRestore', { provider: 'googleDrive', snapshotId: before.snapshotId, strategy: 'safeMerge' }));
        expect(preview?.response.ok).toBe(true);
        const result = await mod.handleCloudBackupRequest(req('cloudBackup:applyRestore', {
            provider: 'googleDrive', snapshotId: before.snapshotId, strategy: 'safeMerge', payloadHash: before.payloadHash,
        }));

        expect(result?.response).toMatchObject({ ok: false, error: { code: 'CONFLICT' } });
        expect(Object.keys(store).filter(key => key.startsWith('bookmark:'))).toEqual([]);
    });

    it('applies a safe-merge restore by adding remote-only bookmarks and preserving local conflicts', async () => {
        const store: StorageMap = {
            'bookmark:chatgpt.com/c/1:1': bookmark(1, 'Local'),
            'aimd:bookmarks:index:v1': ['bookmark:chatgpt.com/c/1:1'],
        };
        (globalThis as any).browser = createInMemoryBrowser(store);

        const { createCloudBackupSnapshot } = await import('../../../../src/core/cloudBackup/snapshot');
        const { buildExportPayload } = await import('../../../../src/core/bookmarks/importExport');
        const snapshot = await createCloudBackupSnapshot(buildExportPayload([bookmark(1, 'Remote'), bookmark(2, 'Remote Only')], true), new Date(0));
        const provider: CloudBackupProvider = {
            connect: vi.fn(),
            disconnect: vi.fn(),
            uploadSnapshot: vi.fn(),
            listSnapshots: vi.fn(async () => []),
            downloadSnapshot: vi.fn(async () => snapshot),
            deleteSnapshot: vi.fn(),
        };

        const mod = await import('../../../../src/runtimes/background/handlers/cloudBackup');
        mod.setCloudBackupProviderFactoryForTests(() => provider);

        const res = await mod.handleCloudBackupRequest({
            v: 1,
            id: 't_cloudBackup:applyRestore',
            type: 'cloudBackup:applyRestore',
            payload: {
                provider: 'googleDrive',
                snapshotId: snapshot.snapshotId,
                strategy: 'safeMerge',
                payloadHash: snapshot.payloadHash,
            },
        } as any);

        expect(res?.response.ok).toBe(true);
        expect((res as any).response.data).toMatchObject({
            restored: 1,
            skippedDuplicates: 0,
            conflicts: 1,
            localOnly: 0,
        });
        expect(store['bookmark:chatgpt.com/c/2:2']).toMatchObject({ title: 'Remote Only' });
        expect(store['bookmark:chatgpt.com/c/1:1']).toMatchObject({ title: 'Local' });
        expect(store['aimd:bookmarks:index:v1']).toEqual([
            'bookmark:chatgpt.com/c/1:1',
            'bookmark:chatgpt.com/c/2:2',
        ]);
        expect(Object.keys(store).some((key) => key.startsWith('aimd:cloud_backup:emergency_restore:googleDrive:v1:'))).toBe(true);
    });

    it('shows and preserves a legacy storage-key collision when restoring an old cloud snapshot', async () => {
        const url = 'https://chatgpt.com/c/12345678-1234-1234-1234-123456789abc';
        const key = 'bookmark:chatgpt.com/c/12345678-1234-1234-1234-123456789abc:1';
        const local = { ...bookmark(1, 'Local'), url, messageId: 'assistant-local' };
        const store: StorageMap = { [key]: local, 'aimd:bookmarks:index:v1': [key] };
        (globalThis as any).browser = createInMemoryBrowser(store);
        const { createCloudBackupSnapshot } = await import('../../../../src/core/cloudBackup/snapshot');
        const { buildExportPayload } = await import('../../../../src/core/bookmarks/importExport');
        const snapshot = await createCloudBackupSnapshot(buildExportPayload([{ ...bookmark(1, 'Remote'), url, messageId: null }], true));
        const mod = await import('../../../../src/runtimes/background/handlers/cloudBackup');
        mod.setCloudBackupProviderFactoryForTests(() => snapshotProvider(snapshot));

        const preview = await mod.handleCloudBackupRequest(req('cloudBackup:previewRestore', { provider: 'googleDrive', snapshotId: snapshot.snapshotId, strategy: 'safeMerge' }));
        expect((preview as any).response.data.plan).toMatchObject({ bookmarksToUpsert: [], conflictCount: 1 });
        const applied = await mod.handleCloudBackupRequest(req('cloudBackup:applyRestore', { provider: 'googleDrive', snapshotId: snapshot.snapshotId, strategy: 'safeMerge', payloadHash: snapshot.payloadHash }));

        expect(applied?.response.ok).toBe(true);
        expect(store[key]).toEqual(local);
    });

    it('creates an emergency snapshot before an explicit local replacement', async () => {
        const store: StorageMap = {
            ...markStores(),
            'bookmark:chatgpt.com/c/1:1': bookmark(1, 'Local'),
            'aimd:bookmarks:index:v1': ['bookmark:chatgpt.com/c/1:1'],
        };
        const browser = createInMemoryBrowser(store);
        (globalThis as any).browser = browser;
        const { createCloudBackupSnapshot } = await import('../../../../src/core/cloudBackup/snapshot');
        const { buildExportPayload } = await import('../../../../src/core/bookmarks/importExport');
        const snapshot = await createCloudBackupSnapshot(buildExportPayload([bookmark(2, 'Remote')], true), new Date(0));
        const provider: CloudBackupProvider = {
            connect: vi.fn(), disconnect: vi.fn(), uploadSnapshot: vi.fn(),
            listSnapshots: vi.fn(async () => []), downloadSnapshot: vi.fn(async () => snapshot), deleteSnapshot: vi.fn(),
        };
        const mod = await import('../../../../src/runtimes/background/handlers/cloudBackup');
        mod.setCloudBackupProviderFactoryForTests(() => provider);

        const result = await mod.handleCloudBackupRequest(req('cloudBackup:applyRestore', {
            provider: 'googleDrive', snapshotId: snapshot.snapshotId, strategy: 'replaceLocal', payloadHash: snapshot.payloadHash,
        }));

        expect(result?.response.ok).toBe(true);
        expect(store['bookmark:chatgpt.com/c/1:1']).toBeUndefined();
        expect(store['bookmark:chatgpt.com/c/2:2']).toMatchObject({ title: 'Remote' });
        expect(store[highlightKey].highlights).toHaveLength(1);
        expect(store[annotationKey].annotations).toHaveLength(1);
        expect(store[catalogKey].folders).toHaveLength(1);
        const emergency = Object.entries(store).find(([key]) => key.startsWith('aimd:cloud_backup:emergency_restore:googleDrive:v1:'))?.[1];
        expect(emergency?.snapshot.payload.bookmarks).toMatchObject([{ title: 'Local' }]);
        expect(browser.storage.local.set.mock.invocationCallOrder[0]).toBeLessThan(browser.storage.local.remove.mock.invocationCallOrder[0]);
    });

    it('moves the selected Google Drive snapshot to trash through the provider', async () => {
        (globalThis as any).browser = createInMemoryBrowser({});
        const provider: CloudBackupProvider = {
            connect: vi.fn(),
            disconnect: vi.fn(),
            uploadSnapshot: vi.fn(),
            listSnapshots: vi.fn(async () => []),
            downloadSnapshot: vi.fn(),
            deleteSnapshot: vi.fn(),
        };

        const mod = await import('../../../../src/runtimes/background/handlers/cloudBackup');
        mod.setCloudBackupProviderFactoryForTests(() => provider);

        const res = await mod.handleCloudBackupRequest(req('cloudBackup:deleteSnapshot', {
            provider: 'googleDrive',
            snapshotId: 'snap-1',
        }));

        expect(res?.response.ok).toBe(true);
        expect((res as any).response.data).toEqual({ trashed: true });
        expect(provider.deleteSnapshot).toHaveBeenCalledWith('snap-1');
    });

    it('surfaces provider configuration status without starting authorization', async () => {
        (globalThis as any).browser = createInMemoryBrowser({});
        const provider: CloudBackupProvider = {
            getConfigurationStatus: vi.fn(() => ({
                configured: false,
                message: 'Google Drive backup requires manifest.oauth2 client_id/scopes.',
            })),
            connect: vi.fn(),
            disconnect: vi.fn(),
            uploadSnapshot: vi.fn(),
            listSnapshots: vi.fn(async () => []),
            downloadSnapshot: vi.fn(),
            deleteSnapshot: vi.fn(),
        };

        const mod = await import('../../../../src/runtimes/background/handlers/cloudBackup');
        mod.setCloudBackupProviderFactoryForTests(() => provider);

        const res = await mod.handleCloudBackupRequest(req('cloudBackup:status', { provider: 'googleDrive' }));

        expect(res?.response.ok).toBe(true);
        expect((res as any).response.data).toMatchObject({
            configured: false,
            connected: false,
            lastError: expect.stringContaining('manifest.oauth2'),
        });
        expect(provider.connect).not.toHaveBeenCalled();
    });

    it('returns Google Drive build diagnostics without starting authorization', async () => {
        (globalThis as any).browser = createInMemoryBrowser({});
        const diagnostics = {
            extensionId: 'bmdhdihdbhjbkfaaainidcjbgidkbeoh',
            expectedExtensionId: 'bmdhdihdbhjbkfaaainidcjbgidkbeoh',
            extensionIdMatchesExpected: true,
            chromeExtensionClientId: '731206378409-ld78d2iflg719pds940tvptiqecirgop.apps.googleusercontent.com',
            webAuthClientId: '731206378409-rmn7hme2qjs90qf6gjub1f0duh483r4n.apps.googleusercontent.com',
            browserFamily: 'webAuthCompatible',
            hasIdentityPermission: true,
            hasGoogleApiHostPermission: true,
            hasManifestOAuthClient: true,
            hasDriveFileScope: true,
            supportsGetAuthToken: true,
            supportsLaunchWebAuthFlow: true,
            redirectUrl: 'https://bmdhdihdbhjbkfaaainidcjbgidkbeoh.chromiumapp.org/',
            oauthRequestPreview: {
                clientId: '731206378409-rmn7hme2qjs90qf6gjub1f0duh483r4n.apps.googleusercontent.com',
                redirectUri: 'https://bmdhdihdbhjbkfaaainidcjbgidkbeoh.chromiumapp.org/',
                scope: 'https://www.googleapis.com/auth/drive.file',
                responseType: 'token',
            },
            authStrategy: 'browserManagedGoogleIdentity',
            usesManifestOAuthClient: true,
            usesWebOAuthClient: false,
            ready: true,
        };
        const provider: CloudBackupProvider = {
            getConfigurationStatus: vi.fn(() => ({ configured: true })),
            getDiagnostics: vi.fn(() => diagnostics),
            connect: vi.fn(),
            disconnect: vi.fn(),
            uploadSnapshot: vi.fn(),
            listSnapshots: vi.fn(async () => []),
            downloadSnapshot: vi.fn(),
            deleteSnapshot: vi.fn(),
        };

        const mod = await import('../../../../src/runtimes/background/handlers/cloudBackup');
        mod.setCloudBackupProviderFactoryForTests(() => provider);

        const res = await mod.handleCloudBackupRequest({
            v: 1,
            id: 't_cloudBackup:diagnostics',
            type: 'cloudBackup:diagnostics',
            payload: { provider: 'googleDrive' },
        } as any);

        expect(res?.response.ok).toBe(true);
        expect((res as any).response.data).toEqual(diagnostics);
        expect(provider.connect).not.toHaveBeenCalled();
    });

    it('stores the connected Google Drive account summary returned by the provider', async () => {
        const store: StorageMap = {};
        (globalThis as any).browser = createInMemoryBrowser(store);
        const provider: CloudBackupProvider = {
            getConfigurationStatus: vi.fn(() => ({ configured: true })),
            getSessionState: vi.fn(() => 'readyInThisSession'),
            connect: vi.fn(async () => ({
                accountEmail: 'zhaoliangbin42@gmail.com',
                accountDisplayName: 'Liangbin Zhao',
                accountPhotoUrl: 'https://lh3.googleusercontent.com/avatar',
                authStrategy: 'webExtensionAccessToken',
            })),
            disconnect: vi.fn(),
            uploadSnapshot: vi.fn(),
            listSnapshots: vi.fn(async () => []),
            downloadSnapshot: vi.fn(),
            deleteSnapshot: vi.fn(),
        };

        const mod = await import('../../../../src/runtimes/background/handlers/cloudBackup');
        mod.setCloudBackupProviderFactoryForTests(() => provider);

        const res = await mod.handleCloudBackupRequest(req('cloudBackup:connect', { provider: 'googleDrive' }));

        expect(res?.response.ok).toBe(true);
        expect((res as any).response.data).toMatchObject({
            connected: true,
            accountEmail: 'zhaoliangbin42@gmail.com',
            accountDisplayName: 'Liangbin Zhao',
            accountPhotoUrl: 'https://lh3.googleusercontent.com/avatar',
            authStrategy: 'webExtensionAccessToken',
            connectedAccount: {
                accountEmail: 'zhaoliangbin42@gmail.com',
                accountDisplayName: 'Liangbin Zhao',
                accountPhotoUrl: 'https://lh3.googleusercontent.com/avatar',
                connectedAt: expect.any(String),
            },
            sessionState: 'readyInThisSession',
            lastVerifiedAt: expect.any(String),
            lastError: null,
        });
    });

    it('reports a connected account as needing confirmation without starting authorization', async () => {
        const store: StorageMap = {
            'aimd:cloud_backup:status:googleDrive:v1': {
                connected: true,
                accountEmail: 'zhaoliangbin42@gmail.com',
                accountDisplayName: 'Liangbin Zhao',
                accountPhotoUrl: 'https://lh3.googleusercontent.com/avatar',
                connectedAt: '2026-06-04T00:00:00.000Z',
                authStrategy: 'webExtensionAccessToken',
            },
        };
        (globalThis as any).browser = createInMemoryBrowser(store);
        const provider: CloudBackupProvider = {
            getConfigurationStatus: vi.fn(() => ({ configured: true })),
            getSessionState: vi.fn(() => 'unknown'),
            connect: vi.fn(),
            disconnect: vi.fn(),
            uploadSnapshot: vi.fn(),
            listSnapshots: vi.fn(async () => []),
            downloadSnapshot: vi.fn(),
            deleteSnapshot: vi.fn(),
        };

        const mod = await import('../../../../src/runtimes/background/handlers/cloudBackup');
        mod.setCloudBackupProviderFactoryForTests(() => provider);

        const res = await mod.handleCloudBackupRequest(req('cloudBackup:status', { provider: 'googleDrive' }));

        expect(res?.response.ok).toBe(true);
        expect((res as any).response.data).toMatchObject({
            configured: true,
            connected: true,
            connectedAccount: {
                accountEmail: 'zhaoliangbin42@gmail.com',
                accountDisplayName: 'Liangbin Zhao',
                accountPhotoUrl: 'https://lh3.googleusercontent.com/avatar',
                connectedAt: '2026-06-04T00:00:00.000Z',
            },
            sessionState: 'needsConfirmation',
        });
        expect(provider.connect).not.toHaveBeenCalled();
        expect(provider.listSnapshots).not.toHaveBeenCalled();
    });

    it('clears stale launchWebAuthFlow schema errors before starting a new Google Drive connect', async () => {
        const store: StorageMap = {
            'aimd:cloud_backup:status:googleDrive:v1': {
                connected: false,
                lastError: "Error in invocation of identity.launchWebAuthFlow(identity.WebAuthFlowDetails details, function callback): Error at parameter 'details': Unexpected property: 'state'.",
            },
        };
        (globalThis as any).browser = createInMemoryBrowser(store);
        const provider: CloudBackupProvider = {
            getConfigurationStatus: vi.fn(() => ({ configured: true })),
            connect: vi.fn(async () => {
                expect(store['aimd:cloud_backup:status:googleDrive:v1']).toMatchObject({
                    connected: false,
                    lastError: null,
                });
                return {
                    accountEmail: 'zhaoliangbin42@gmail.com',
                    accountDisplayName: 'Liangbin Zhao',
                    authStrategy: 'webExtensionAccessToken',
                };
            }),
            disconnect: vi.fn(),
            uploadSnapshot: vi.fn(),
            listSnapshots: vi.fn(async () => []),
            downloadSnapshot: vi.fn(),
            deleteSnapshot: vi.fn(),
        };

        const mod = await import('../../../../src/runtimes/background/handlers/cloudBackup');
        mod.setCloudBackupProviderFactoryForTests(() => provider);

        const res = await mod.handleCloudBackupRequest(req('cloudBackup:connect', { provider: 'googleDrive' }));

        expect(res?.response.ok).toBe(true);
        expect((res as any).response.data).toMatchObject({
            connected: true,
            lastError: null,
            accountEmail: 'zhaoliangbin42@gmail.com',
        });
    });

    it('clears stored Google Drive account details when disconnecting', async () => {
        const store: StorageMap = {
            'aimd:cloud_backup:status:googleDrive:v1': {
                connected: true,
                accountEmail: 'old@example.com',
                accountDisplayName: 'Old Account',
                accountPhotoUrl: 'https://example.com/photo',
                authStrategy: 'webExtensionAccessToken',
            },
        };
        (globalThis as any).browser = createInMemoryBrowser(store);
        const provider: CloudBackupProvider = {
            connect: vi.fn(),
            disconnect: vi.fn(async () => undefined),
            uploadSnapshot: vi.fn(),
            listSnapshots: vi.fn(async () => []),
            downloadSnapshot: vi.fn(),
            deleteSnapshot: vi.fn(),
        };

        const mod = await import('../../../../src/runtimes/background/handlers/cloudBackup');
        mod.setCloudBackupProviderFactoryForTests(() => provider);

        const res = await mod.handleCloudBackupRequest(req('cloudBackup:disconnect', { provider: 'googleDrive' }));

        expect(res?.response.ok).toBe(true);
        expect((res as any).response.data).toMatchObject({
            connected: false,
            connectedAccount: null,
            sessionState: 'unknown',
            accountEmail: null,
            accountDisplayName: null,
            accountPhotoUrl: null,
            lastError: null,
        });
    });

    it('clears a stale build configuration error after the current build is configured', async () => {
        const store: StorageMap = {
            'aimd:cloud_backup:status:googleDrive:v1': {
                connected: false,
                lastError: 'Google Drive backup requires manifest.oauth2 client_id/scopes.',
            },
        };
        (globalThis as any).browser = createInMemoryBrowser(store);
        const provider: CloudBackupProvider = {
            getConfigurationStatus: vi.fn(() => ({ configured: true })),
            connect: vi.fn(),
            disconnect: vi.fn(),
            uploadSnapshot: vi.fn(),
            listSnapshots: vi.fn(async () => []),
            downloadSnapshot: vi.fn(),
            deleteSnapshot: vi.fn(),
        };

        const mod = await import('../../../../src/runtimes/background/handlers/cloudBackup');
        mod.setCloudBackupProviderFactoryForTests(() => provider);

        const res = await mod.handleCloudBackupRequest(req('cloudBackup:status', { provider: 'googleDrive' }));

        expect(res?.response.ok).toBe(true);
        expect((res as any).response.data).toMatchObject({
            configured: true,
            connected: false,
            lastError: null,
        });
        expect(store['aimd:cloud_backup:status:googleDrive:v1']).toMatchObject({
            connected: false,
            lastError: null,
        });
    });

    it('clears a stale missing identity permission error after the current build is configured', async () => {
        const store: StorageMap = {
            'aimd:cloud_backup:status:googleDrive:v1': {
                connected: false,
                lastError: 'Google Drive backup is only available in a Chrome build with the identity permission',
            },
        };
        (globalThis as any).browser = createInMemoryBrowser(store);
        const provider: CloudBackupProvider = {
            getConfigurationStatus: vi.fn(() => ({ configured: true })),
            connect: vi.fn(),
            disconnect: vi.fn(),
            uploadSnapshot: vi.fn(),
            listSnapshots: vi.fn(async () => []),
            downloadSnapshot: vi.fn(),
            deleteSnapshot: vi.fn(),
        };

        const mod = await import('../../../../src/runtimes/background/handlers/cloudBackup');
        mod.setCloudBackupProviderFactoryForTests(() => provider);

        const res = await mod.handleCloudBackupRequest(req('cloudBackup:status', { provider: 'googleDrive' }));

        expect(res?.response.ok).toBe(true);
        expect((res as any).response.data).toMatchObject({
            configured: true,
            connected: false,
            lastError: null,
        });
        expect(store['aimd:cloud_backup:status:googleDrive:v1']).toMatchObject({
            connected: false,
            lastError: null,
        });
    });

    it('clears a stale launchWebAuthFlow state schema error after the current build is configured', async () => {
        const store: StorageMap = {
            'aimd:cloud_backup:status:googleDrive:v1': {
                connected: false,
                lastError: "Error in invocation of identity.launchWebAuthFlow(identity.WebAuthFlowDetails details, function callback): Error at parameter 'details': Unexpected property: 'state'.",
            },
        };
        (globalThis as any).browser = createInMemoryBrowser(store);
        const provider: CloudBackupProvider = {
            getConfigurationStatus: vi.fn(() => ({ configured: true })),
            connect: vi.fn(),
            disconnect: vi.fn(),
            uploadSnapshot: vi.fn(),
            listSnapshots: vi.fn(async () => []),
            downloadSnapshot: vi.fn(),
            deleteSnapshot: vi.fn(),
        };

        const mod = await import('../../../../src/runtimes/background/handlers/cloudBackup');
        mod.setCloudBackupProviderFactoryForTests(() => provider);

        const res = await mod.handleCloudBackupRequest(req('cloudBackup:status', { provider: 'googleDrive' }));

        expect(res?.response.ok).toBe(true);
        expect((res as any).response.data).toMatchObject({
            configured: true,
            connected: false,
            lastError: null,
        });
        expect(store['aimd:cloud_backup:status:googleDrive:v1']).toMatchObject({
            connected: false,
            lastError: null,
        });
    });

    it('clears a stale Chrome Extension OAuth client error after the current build is configured', async () => {
        const store: StorageMap = {
            'aimd:cloud_backup:status:googleDrive:v1': {
                connected: false,
                lastError: 'Google Drive backup is configured with an invalid OAuth client. Use a Google Cloud Chrome Extension OAuth client ID and make sure it is bound to the current Chrome extension ID.',
            },
        };
        (globalThis as any).browser = createInMemoryBrowser(store);
        const provider: CloudBackupProvider = {
            getConfigurationStatus: vi.fn(() => ({ configured: true })),
            connect: vi.fn(),
            disconnect: vi.fn(),
            uploadSnapshot: vi.fn(),
            listSnapshots: vi.fn(async () => []),
            downloadSnapshot: vi.fn(),
            deleteSnapshot: vi.fn(),
        };

        const mod = await import('../../../../src/runtimes/background/handlers/cloudBackup');
        mod.setCloudBackupProviderFactoryForTests(() => provider);

        const res = await mod.handleCloudBackupRequest(req('cloudBackup:status', { provider: 'googleDrive' }));

        expect(res?.response.ok).toBe(true);
        expect((res as any).response.data).toMatchObject({
            configured: true,
            connected: false,
            lastError: null,
        });
        expect(store['aimd:cloud_backup:status:googleDrive:v1']).toMatchObject({
            connected: false,
            lastError: null,
        });
    });
});
