import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ExtRequest } from '../../../../src/contracts/protocol';

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
        getBytesInUse: vi.fn(async (_keys: any) => JSON.stringify(store).length),
    };

    return {
        runtime: { getManifest: () => ({ manifest_version: 3 }) },
        storage: { local },
    };
}

function req<T extends ExtRequest['type']>(type: T, payload?: any): Extract<ExtRequest, { type: T }> {
    return { v: 1, id: `t_${type}`, type, payload } as any;
}

describe('background bookmarks handler', () => {
    beforeEach(() => {
        vi.resetModules();
        vi.clearAllMocks();
        delete (globalThis as any).browser;
        delete (globalThis as any).chrome;
    });

    it('saves and lists bookmarks using legacy key schema + index', async () => {
        const store: StorageMap = {};
        (globalThis as any).browser = createInMemoryBrowser(store);

        const { handleBookmarksRequest } = await import('../../../../src/runtimes/background/handlers/bookmarks');

        const saveRes = await handleBookmarksRequest(req('bookmarks:save', {
            url: 'https://chatgpt.com/c/1',
            position: 1,
            userMessage: 'u',
            aiResponse: 'a',
            title: 'T',
            platform: 'ChatGPT',
            folderPath: 'Import',
            options: { saveContextOnly: false },
        }));
        expect(saveRes?.response.ok).toBe(true);

        const listRes = await handleBookmarksRequest(req('bookmarks:list', { sortMode: 'time-desc' }));
        expect(listRes?.response.ok).toBe(true);
        const data: any = (listRes as any).response.data;
        expect(data.bookmarks).toHaveLength(1);
        expect(Object.keys(store).some((k) => k.startsWith('bookmark:chatgpt.com/c/1:1'))).toBe(true);
        expect(Array.isArray(store['aimd:bookmarks:index:v1'])).toBe(true);
    });

    it('writes v3 keys for identified messages without rewriting a legacy record', async () => {
        const url = 'https://chatgpt.com/c/12345678-1234-1234-1234-123456789abc';
        const legacyKey = 'bookmark:chatgpt.com/c/12345678-1234-1234-1234-123456789abc:2';
        const legacy = { url, urlWithoutProtocol: url.slice(8), position: 2, messageId: 'assistant-old', userMessage: 'Old', timestamp: 1, title: 'Old', platform: 'ChatGPT', folderPath: 'Import' };
        const store: StorageMap = { [legacyKey]: legacy, 'aimd:bookmarks:index:v1': [legacyKey] };
        (globalThis as any).browser = createInMemoryBrowser(store);
        const { handleBookmarksRequest } = await import('../../../../src/runtimes/background/handlers/bookmarks');

        await handleBookmarksRequest(req('bookmarks:save', { url, position: 3, messageId: 'assistant-new', userMessage: 'New', platform: 'ChatGPT', folderPath: 'Import' }));

        expect(store[legacyKey]).toEqual(legacy);
        expect(store['bookmark:message:v3:12345678-1234-1234-1234-123456789abc:assistant-new']).toMatchObject({ position: 3, messageId: 'assistant-new' });
        expect(store['aimd:bookmarks:index:v1']).toHaveLength(2);
    });

    it('removes a moved legacy bookmark by unique identity and preserves other keys', async () => {
        const url = 'https://chatgpt.com/c/12345678-1234-1234-1234-123456789abc';
        const oldKey = `bookmark:${url.slice(8)}:2`;
        const otherKey = `bookmark:${url.slice(8)}:3`;
        const record = (position: number, messageId: string) => ({ url, urlWithoutProtocol: url.slice(8), position, messageId, userMessage: 'Prompt', timestamp: 1, title: 'Prompt', platform: 'ChatGPT', folderPath: 'Import' });
        const store: StorageMap = { [oldKey]: record(2, 'assistant-old'), [otherKey]: record(3, 'assistant-other'), 'aimd:bookmarks:index:v1': [oldKey, otherKey] };
        (globalThis as any).browser = createInMemoryBrowser(store);
        const { handleBookmarksRequest } = await import('../../../../src/runtimes/background/handlers/bookmarks');

        const result = await handleBookmarksRequest(req('bookmarks:remove', { url, position: 9, messageId: 'assistant-old' }));

        expect(result?.response.ok).toBe(true);
        expect(store[oldKey]).toBeUndefined();
        expect(store[otherKey]).toBeTruthy();
    });

    it('keeps duplicate legacy records and requires an exact manager choice to remove one', async () => {
        const url = 'https://chatgpt.com/c/12345678-1234-1234-1234-123456789abc';
        const firstKey = `bookmark:${url.slice(8)}:2`;
        const secondKey = `bookmark:${url.slice(8)}:5`;
        const record = (position: number) => ({ url, urlWithoutProtocol: url.slice(8), position, messageId: 'same-assistant', userMessage: 'Prompt', timestamp: position, title: 'Prompt', platform: 'ChatGPT', folderPath: 'Import' });
        const store: StorageMap = { [firstKey]: record(2), [secondKey]: record(5), 'aimd:bookmarks:index:v1': [firstKey, secondKey] };
        (globalThis as any).browser = createInMemoryBrowser(store);
        const { handleBookmarksRequest } = await import('../../../../src/runtimes/background/handlers/bookmarks');

        const toggle = await handleBookmarksRequest(req('bookmarks:remove', { url, position: 9, messageId: 'same-assistant' }));
        expect(toggle?.response.ok).toBe(false);
        expect(store[firstKey]).toBeTruthy();
        expect(store[secondKey]).toBeTruthy();

        const manager = await handleBookmarksRequest(req('bookmarks:bulkRemove', { items: [{ url, position: 2, messageId: 'same-assistant' }] }));
        expect(manager?.response.ok).toBe(true);
        expect(store[firstKey]).toBeUndefined();
        expect(store[secondKey]).toBeTruthy();
    });

    it('renames an old identified record in place without creating a v3 duplicate', async () => {
        const url = 'https://chatgpt.com/c/12345678-1234-1234-1234-123456789abc';
        const key = `bookmark:${url.slice(8)}:2`;
        const store: StorageMap = { [key]: { url, urlWithoutProtocol: url.slice(8), position: 2, messageId: 'assistant-2', userMessage: 'Prompt', timestamp: 1, title: 'Old', platform: 'ChatGPT', folderPath: 'Import' }, 'aimd:bookmarks:index:v1': [key] };
        (globalThis as any).browser = createInMemoryBrowser(store);
        const { handleBookmarksRequest } = await import('../../../../src/runtimes/background/handlers/bookmarks');

        const result = await handleBookmarksRequest(req('bookmarks:save', { url, position: 2, messageId: 'assistant-2', userMessage: 'Prompt', timestamp: 1, title: 'New', platform: 'ChatGPT', folderPath: 'Import', options: { updateExisting: true } }));

        expect(result?.response.ok).toBe(true);
        expect(store[key].title).toBe('New');
        expect(Object.keys(store).filter((entry) => entry.startsWith('bookmark:'))).toEqual([key]);
    });

    it('imports two legacy records for one message without collapsing either', async () => {
        const url = 'https://chatgpt.com/c/12345678-1234-1234-1234-123456789abc';
        const record = (position: number) => ({ url, position, messageId: 'assistant-1', userMessage: 'Prompt', timestamp: position, title: `Bookmark ${position}`, platform: 'ChatGPT', folderPath: 'Import' });
        const store: StorageMap = {};
        (globalThis as any).browser = createInMemoryBrowser(store);
        const { handleBookmarksRequest } = await import('../../../../src/runtimes/background/handlers/bookmarks');

        const result = await handleBookmarksRequest(req('bookmarks:import', {
            jsonText: JSON.stringify({ version: '2.0', bookmarks: [record(2), record(5)] }),
        }));

        expect(result?.response.ok).toBe(true);
        expect(store[`bookmark:${url.slice(8)}:2`]).toMatchObject({ position: 2 });
        expect(store[`bookmark:${url.slice(8)}:5`]).toMatchObject({ position: 5 });
        expect(store['aimd:bookmarks:index:v1']).toHaveLength(2);
    });

    it('exports and imports bookmarks, marks and empty folders through the same Library file', async () => {
        const { LEGACY_STORAGE_KEYS } = await import('../../../../src/contracts/storage');
        const document = { platform: 'chatgpt', conversationId: 'sample', title: 'Sample' };
        const record = { id: 'mark-1', itemId: 'item-1', target: { assistantMessageId: 'assistant-1' }, quoteText: 'quote', sourceMarkdown: 'quote', selectors: { textQuote: { exact: 'quote', prefix: '', suffix: '' }, textPosition: { start: 0, end: 5 }, domRange: null, atomicRefs: [] }, createdAt: 1, updatedAt: 1, revision: 1 };
        const highlightKey = 'aimd:highlights:document:v1:chatgpt:conversation:sample';
        const annotationKey = 'aimd:reader_annotations:document:chatgpt:conversation:sample';
        const catalogKey = 'aimd:mark_library:catalog:v1';
        const source: StorageMap = {
            'bookmark:chatgpt.com/c/sample:1': { url: 'https://chatgpt.com/c/sample', position: 1, messageId: 'assistant-1', userMessage: 'Question', timestamp: 1, title: 'Saved', platform: 'ChatGPT', folderPath: 'Work' },
            'aimd:bookmarks:index:v1': ['bookmark:chatgpt.com/c/sample:1'],
            [LEGACY_STORAGE_KEYS.folderPathsIndex]: ['Work', 'Empty'],
            'folder:Work': { path: 'Work', name: 'Work', depth: 1, createdAt: 1, updatedAt: 1 },
            'folder:Empty': { path: 'Empty', name: 'Empty', depth: 1, createdAt: 1, updatedAt: 1 },
            [highlightKey]: { schemaVersion: 1, document, highlights: [{ ...record, color: 'blue' }] },
            [annotationKey]: { schemaVersion: 1, document, annotations: [{ ...record, comment: 'Note', lastKnownAnchorState: 'anchored' }] },
            [catalogKey]: { schemaVersion: 1, revision: 1, folders: [{ id: 'folder-1', parentId: null, name: 'Research', createdAt: 1, updatedAt: 1 }], conversations: [{ document, folderId: 'folder-1', customTitle: 'My title', updatedAt: 1 }] },
        };
        (globalThis as any).browser = createInMemoryBrowser(source);
        let { handleBookmarksRequest } = await import('../../../../src/runtimes/background/handlers/bookmarks');
        const exported = await handleBookmarksRequest(req('bookmarks:export', { preserveStructure: true }));
        expect(exported?.response.ok).toBe(true);
        const payload = (exported as any).response.data.payload;
        expect(payload.version).toBe('4.0');
        expect(payload.bookmarkFolders).toContain('Empty');
        expect(payload.highlights[0].highlights).toHaveLength(1);
        expect(payload.annotations[0].annotations).toHaveLength(1);
        payload.futureMetadata = { ignored: true };

        vi.resetModules();
        const restored: StorageMap = {};
        (globalThis as any).browser = createInMemoryBrowser(restored);
        ({ handleBookmarksRequest } = await import('../../../../src/runtimes/background/handlers/bookmarks'));
        const result = await handleBookmarksRequest(req('bookmarks:import', { jsonText: JSON.stringify(payload) }));

        expect(result?.response.ok).toBe(true);
        expect(restored[highlightKey].highlights).toHaveLength(1);
        expect(restored[annotationKey].annotations[0].comment).toBe('Note');
        expect(restored[catalogKey].conversations[0].customTitle).toBe('My title');
        expect(restored[LEGACY_STORAGE_KEYS.folderPathsIndex]).toContain('Empty');
        expect(restored['aimd:bookmarks:index:v1']).toHaveLength(1);
        const repeated = await handleBookmarksRequest(req('bookmarks:import', { jsonText: JSON.stringify(payload) }));
        expect(repeated?.response.ok).toBe(true);
        expect((repeated as any).response.data).toMatchObject({ imported: 0, library: { highlights: { added: 0 }, annotations: { added: 0 }, folders: { added: 0 } } });
        expect(restored[highlightKey].highlights).toHaveLength(1);
        expect(restored[annotationKey].annotations).toHaveLength(1);
    });

    it('refuses a full export when a valid bookmark is absent from its index', async () => {
        const record = (position: number) => ({ url: `https://chatgpt.com/c/${position}`, position, userMessage: `Question ${position}`, timestamp: position, title: `Saved ${position}`, platform: 'ChatGPT', folderPath: 'Import' });
        const store: StorageMap = {
            'bookmark:chatgpt.com/c/1:1': record(1),
            'bookmark:chatgpt.com/c/2:2': record(2),
            'aimd:bookmarks:index:v1': ['bookmark:chatgpt.com/c/1:1'],
        };
        (globalThis as any).browser = createInMemoryBrowser(store);
        const { handleBookmarksRequest } = await import('../../../../src/runtimes/background/handlers/bookmarks');

        const result = await handleBookmarksRequest(req('bookmarks:export', { preserveStructure: true }));

        expect(result?.response).toMatchObject({ ok: false, error: { code: 'SNAPSHOT_CORRUPTED' } });
        expect(store['bookmark:chatgpt.com/c/2:2']).toEqual(record(2));
    });

    it('refuses a full export when an empty folder is absent from its index', async () => {
        const { LEGACY_STORAGE_KEYS } = await import('../../../../src/contracts/storage');
        const folder = (path: string) => ({ path, name: path, depth: 1, createdAt: 1, updatedAt: 1 });
        const store: StorageMap = {
            [LEGACY_STORAGE_KEYS.folderPathsIndex]: ['Indexed'],
            'folder:Indexed': folder('Indexed'),
            'folder:Missing': folder('Missing'),
        };
        (globalThis as any).browser = createInMemoryBrowser(store);
        const { handleBookmarksRequest } = await import('../../../../src/runtimes/background/handlers/bookmarks');

        const result = await handleBookmarksRequest(req('bookmarks:export', { preserveStructure: true }));

        expect(result?.response).toMatchObject({ ok: false, error: { code: 'SNAPSHOT_CORRUPTED' } });
        expect(store['folder:Missing']).toEqual(folder('Missing'));
    });

    it('imports an older bookmark file without touching existing highlights or annotations', async () => {
        const highlightKey = 'aimd:highlights:document:v1:chatgpt:conversation:sample';
        const annotationKey = 'aimd:reader_annotations:document:chatgpt:conversation:sample';
        const store: StorageMap = { [highlightKey]: { retained: 'highlight' }, [annotationKey]: { retained: 'annotation' } };
        (globalThis as any).browser = createInMemoryBrowser(store);
        const { handleBookmarksRequest } = await import('../../../../src/runtimes/background/handlers/bookmarks');
        const oldFile = { version: '2.0', bookmarks: [{ url: 'https://chatgpt.com/c/old', position: 1, userMessage: 'Old', timestamp: 1, folderPath: 'Import' }] };

        const result = await handleBookmarksRequest(req('bookmarks:import', { jsonText: JSON.stringify(oldFile) }));

        expect(result?.response.ok).toBe(true);
        expect(store[highlightKey]).toEqual({ retained: 'highlight' });
        expect(store[annotationKey]).toEqual({ retained: 'annotation' });
    });

    it('rejects a malformed Library file without importing its valid-looking bookmarks', async () => {
        const store: StorageMap = {};
        (globalThis as any).browser = createInMemoryBrowser(store);
        const { handleBookmarksRequest } = await import('../../../../src/runtimes/background/handlers/bookmarks');
        const file = { version: '4.0', exportDate: new Date().toISOString(), bookmarks: [{ url: 'https://chatgpt.com/c/1', position: 1, userMessage: 'Question', timestamp: 1 }], bookmarkFolders: [], highlights: [{ broken: true }], annotations: [], markCatalog: { schemaVersion: 1, revision: 0, folders: [], conversations: [] } };

        const result = await handleBookmarksRequest(req('bookmarks:import', { jsonText: JSON.stringify(file) }));

        expect(result?.response).toMatchObject({ ok: false, error: { code: 'SNAPSHOT_CORRUPTED' } });
        expect(Object.keys(store).filter(key => key.startsWith('bookmark:'))).toEqual([]);
    });

    it('does not overwrite a legacy bookmark when a remote record resolves to the same storage key', async () => {
        const url = 'https://chatgpt.com/c/12345678-1234-1234-1234-123456789abc';
        const key = 'bookmark:chatgpt.com/c/12345678-1234-1234-1234-123456789abc:1';
        const local = { url, position: 1, messageId: 'assistant-local', userMessage: 'Local', timestamp: 1, title: 'Local', platform: 'ChatGPT', folderPath: 'Import' };
        const store: StorageMap = { [key]: local, 'aimd:bookmarks:index:v1': [key] };
        (globalThis as any).browser = createInMemoryBrowser(store);
        const { handleBookmarksRequest } = await import('../../../../src/runtimes/background/handlers/bookmarks');
        const remote = { version: '4.0', exportDate: new Date().toISOString(), bookmarks: [{ url, position: 1, messageId: null, userMessage: 'Remote', timestamp: 2, title: 'Remote', platform: 'ChatGPT', folderPath: 'Import' }], bookmarkFolders: [], highlights: [], annotations: [], markCatalog: { schemaVersion: 1, revision: 0, folders: [], conversations: [] } };

        const result = await handleBookmarksRequest(req('bookmarks:import', { jsonText: JSON.stringify(remote) }));

        expect(result?.response.ok).toBe(true);
        expect(store[key]).toEqual(local);
        expect((result as any).response.data.conflicts).toBeGreaterThan(0);
    });

    it('keeps the same local bookmark safe when importing an older 2.0 file', async () => {
        const url = 'https://chatgpt.com/c/12345678-1234-1234-1234-123456789abc';
        const key = 'bookmark:chatgpt.com/c/12345678-1234-1234-1234-123456789abc:1';
        const local = { url, position: 1, messageId: 'assistant-local', userMessage: 'Local', timestamp: 1, title: 'Local', platform: 'ChatGPT', folderPath: 'Import' };
        const store: StorageMap = { [key]: local, 'aimd:bookmarks:index:v1': [key] };
        (globalThis as any).browser = createInMemoryBrowser(store);
        const { handleBookmarksRequest } = await import('../../../../src/runtimes/background/handlers/bookmarks');

        const result = await handleBookmarksRequest(req('bookmarks:import', { jsonText: JSON.stringify({ version: '2.0', bookmarks: [{ url, position: 1, userMessage: 'Remote', timestamp: 2, title: 'Remote', platform: 'ChatGPT', folderPath: 'Import' }] }) }));

        expect(result?.response.ok).toBe(true);
        expect(store[key]).toEqual(local);
        expect((result as any).response.data.conflicts).toBeGreaterThan(0);
    });

    it('does not overwrite a locally stored bookmark missing from a partial index during older-file import', async () => {
        const url = 'https://chatgpt.com/c/12345678-1234-1234-1234-123456789abc';
        const key = 'bookmark:chatgpt.com/c/12345678-1234-1234-1234-123456789abc:1';
        const local = { url, position: 1, messageId: 'assistant-local', userMessage: 'Local', timestamp: 1, title: 'Local', platform: 'ChatGPT', folderPath: 'Import' };
        const store: StorageMap = { [key]: local, 'aimd:bookmarks:index:v1': [] };
        (globalThis as any).browser = createInMemoryBrowser(store);
        const { handleBookmarksRequest } = await import('../../../../src/runtimes/background/handlers/bookmarks');

        const result = await handleBookmarksRequest(req('bookmarks:import', { jsonText: JSON.stringify({ version: '2.0', bookmarks: [{ url, position: 1, userMessage: 'Remote', timestamp: 2, title: 'Remote', platform: 'ChatGPT', folderPath: 'Import' }] }) }));

        expect(result?.response.ok).toBe(true);
        expect(store[key]).toEqual(local);
        expect((result as any).response.data.conflicts).toBeGreaterThan(0);
    });

    it('round-trips two historical bookmarks for one message through a 4.0 Library file', async () => {
        const url = 'https://chatgpt.com/c/12345678-1234-1234-1234-123456789abc';
        const key = (position: number) => `bookmark:chatgpt.com/c/12345678-1234-1234-1234-123456789abc:${position}`;
        const record = (position: number) => ({ url, position, messageId: 'same-assistant', userMessage: 'Prompt', timestamp: position, title: `Bookmark ${position}`, platform: 'ChatGPT', folderPath: 'Import' });
        const source: StorageMap = { [key(2)]: record(2), [key(5)]: record(5), 'aimd:bookmarks:index:v1': [key(2), key(5)] };
        (globalThis as any).browser = createInMemoryBrowser(source);
        let { handleBookmarksRequest } = await import('../../../../src/runtimes/background/handlers/bookmarks');
        const exported = await handleBookmarksRequest(req('bookmarks:export', { preserveStructure: true }));
        expect(exported?.response.ok).toBe(true);

        vi.resetModules();
        const restored: StorageMap = {};
        (globalThis as any).browser = createInMemoryBrowser(restored);
        ({ handleBookmarksRequest } = await import('../../../../src/runtimes/background/handlers/bookmarks'));
        const result = await handleBookmarksRequest(req('bookmarks:import', { jsonText: JSON.stringify((exported as any).response.data.payload) }));

        expect(result?.response.ok).toBe(true);
        expect(restored[key(2)]).toMatchObject({ position: 2, messageId: 'same-assistant' });
        expect(restored[key(5)]).toMatchObject({ position: 5, messageId: 'same-assistant' });
    });

    it('repairs corrupted records and quarantines before removal', async () => {
        const store: StorageMap = {
            'bookmark:chatgpt.com/c/bad:1': 'corrupted',
        };
        (globalThis as any).browser = createInMemoryBrowser(store);

        const { handleBookmarksRequest } = await import('../../../../src/runtimes/background/handlers/bookmarks');

        const res = await handleBookmarksRequest(req('bookmarks:repair'));
        expect(res?.response.ok).toBe(true);
        expect(Object.keys(store).some((k) => k.startsWith('aimd:bookmarks:quarantine:v1:'))).toBe(true);
        expect(store['bookmark:chatgpt.com/c/bad:1']).toBeUndefined();
    });

    it('rejects folder rename with invalid name segment', async () => {
        const store: StorageMap = {
            folderPaths: ['A'],
            'folder:A': { path: 'A', name: 'A', depth: 1, createdAt: 1, updatedAt: 1 },
        };
        (globalThis as any).browser = createInMemoryBrowser(store);

        const { handleBookmarksRequest } = await import('../../../../src/runtimes/background/handlers/bookmarks');

        const res = await handleBookmarksRequest(req('bookmarks:folders:rename', { oldPath: 'A', newName: 'X/Y' }));
        expect(res?.response.ok).toBe(false);
        expect((res as any).response.error.code).toBe('INVALID_PATH');
    });

    it('prevents moving a folder into its own descendant', async () => {
        const store: StorageMap = {
            folderPaths: ['A', 'A/B'],
            'folder:A': { path: 'A', name: 'A', depth: 1, createdAt: 1, updatedAt: 1 },
            'folder:A/B': { path: 'A/B', name: 'B', depth: 2, createdAt: 1, updatedAt: 1 },
        };
        (globalThis as any).browser = createInMemoryBrowser(store);

        const { handleBookmarksRequest } = await import('../../../../src/runtimes/background/handlers/bookmarks');

        const res = await handleBookmarksRequest(req('bookmarks:folders:move', { sourcePath: 'A', targetParentPath: 'A/B' }));
        expect(res?.response.ok).toBe(false);
        expect((res as any).response.error.code).toBe('INVALID_PATH');
    });

    it('blocks folder deletion when descendant bookmarks exist (even if folder records are missing)', async () => {
        const store: StorageMap = {
            folderPaths: ['Work'],
            'folder:Work': { path: 'Work', name: 'Work', depth: 1, createdAt: 1, updatedAt: 1 },
            'bookmark:chatgpt.com/c/1:1': {
                url: 'https://chatgpt.com/c/1',
                urlWithoutProtocol: 'chatgpt.com/c/1',
                position: 1,
                userMessage: 'u',
                aiResponse: 'a',
                timestamp: 1,
                title: 'T',
                platform: 'ChatGPT',
                folderPath: 'Work/Sub',
            },
        };
        (globalThis as any).browser = createInMemoryBrowser(store);

        const { handleBookmarksRequest } = await import('../../../../src/runtimes/background/handlers/bookmarks');

        const res = await handleBookmarksRequest(req('bookmarks:folders:delete', { path: 'Work' }));
        expect(res?.response.ok).toBe(false);
        expect((res as any).response.error.code).toBe('CONFLICT');
    });

    it('moves folder subtree and updates affected bookmark folderPath', async () => {
        const store: StorageMap = {
            folderPaths: ['A', 'A/B'],
            'folder:A': { path: 'A', name: 'A', depth: 1, createdAt: 1, updatedAt: 1 },
            'folder:A/B': { path: 'A/B', name: 'B', depth: 2, createdAt: 1, updatedAt: 1 },
            'bookmark:chatgpt.com/c/1:1': {
                url: 'https://chatgpt.com/c/1',
                urlWithoutProtocol: 'chatgpt.com/c/1',
                position: 1,
                userMessage: 'u',
                aiResponse: 'a',
                timestamp: 1,
                title: 'T',
                platform: 'ChatGPT',
                folderPath: 'A/B',
            },
            'aimd:bookmarks:index:v1': ['bookmark:chatgpt.com/c/1:1'],
        };
        (globalThis as any).browser = createInMemoryBrowser(store);

        const { handleBookmarksRequest } = await import('../../../../src/runtimes/background/handlers/bookmarks');

        const res = await handleBookmarksRequest(req('bookmarks:folders:move', { sourcePath: 'A/B', targetParentPath: '' }));
        expect(res?.response.ok).toBe(true);
        expect(store.folderPaths).toEqual(['A', 'B']);
        expect(store['folder:B']).toBeTruthy();
        expect(store['folder:A/B']).toBeUndefined();
        expect(store['bookmark:chatgpt.com/c/1:1'].folderPath).toBe('B');
        expect(store['aimd:bookmarks:journal:v1']).toBeUndefined();
    });

    it('returns positions snapshot for a conversation url', async () => {
        const store: StorageMap = {};
        (globalThis as any).browser = createInMemoryBrowser(store);

        const { handleBookmarksRequest } = await import('../../../../src/runtimes/background/handlers/bookmarks');

        await handleBookmarksRequest(req('bookmarks:save', {
            url: 'https://chatgpt.com/c/1',
            position: 2,
            userMessage: 'u2',
            aiResponse: 'a2',
            platform: 'ChatGPT',
            folderPath: 'Import',
            options: { saveContextOnly: false },
        }));
        await handleBookmarksRequest(req('bookmarks:save', {
            url: 'https://chatgpt.com/c/1',
            position: 1,
            userMessage: 'u1',
            aiResponse: 'a1',
            platform: 'ChatGPT',
            folderPath: 'Import',
            options: { saveContextOnly: false },
        }));
        await handleBookmarksRequest(req('bookmarks:save', {
            url: 'https://chatgpt.com/c/2',
            position: 1,
            userMessage: 'u',
            aiResponse: 'a',
            platform: 'ChatGPT',
            folderPath: 'Import',
            options: { saveContextOnly: false },
        }));

        const res = await handleBookmarksRequest(req('bookmarks:positions', { url: 'https://chatgpt.com/c/1' }));
        expect(res?.response.ok).toBe(true);
        expect((res as any).response.data.positions).toEqual([1, 2]);
    });

    it('saves page bookmarks separately from message positions', async () => {
        const store: StorageMap = {};
        (globalThis as any).browser = createInMemoryBrowser(store);

        const { handleBookmarksRequest } = await import('../../../../src/runtimes/background/handlers/bookmarks');

        const save = await handleBookmarksRequest(req('bookmarks:page:save', {
            url: 'https://chatgpt.com/c/page-1',
            title: 'Conversation title',
            platform: 'ChatGPT',
            folderPath: 'Import',
        }));
        expect(save?.response.ok).toBe(true);
        expect(store['bookmark:page:chatgpt.com/c/page-1']).toMatchObject({
            kind: 'page',
            title: 'Conversation title',
            urlWithoutProtocol: 'chatgpt.com/c/page-1',
        });

        const status = await handleBookmarksRequest(req('bookmarks:page:status', { url: 'https://chatgpt.com/c/page-1' }));
        expect((status as any).response.data.saved).toBe(true);

        const positions = await handleBookmarksRequest(req('bookmarks:positions', { url: 'https://chatgpt.com/c/page-1' }));
        expect((positions as any).response.data.positions).toEqual([]);

        const remove = await handleBookmarksRequest(req('bookmarks:page:remove', { url: 'https://chatgpt.com/c/page-1' }));
        expect(remove?.response.ok).toBe(true);
        expect(store['bookmark:page:chatgpt.com/c/page-1']).toBeUndefined();
    });

    it('supports bulk remove and keeps index consistent', async () => {
        const store: StorageMap = {};
        (globalThis as any).browser = createInMemoryBrowser(store);

        const { handleBookmarksRequest } = await import('../../../../src/runtimes/background/handlers/bookmarks');

        await handleBookmarksRequest(req('bookmarks:save', {
            url: 'https://chatgpt.com/c/1',
            position: 1,
            userMessage: 'u',
            aiResponse: 'a',
            platform: 'ChatGPT',
            folderPath: 'Import',
            options: { saveContextOnly: false },
        }));
        await handleBookmarksRequest(req('bookmarks:save', {
            url: 'https://chatgpt.com/c/1',
            position: 2,
            userMessage: 'u',
            aiResponse: 'a',
            platform: 'ChatGPT',
            folderPath: 'Import',
            options: { saveContextOnly: false },
        }));

        const bulk = await handleBookmarksRequest(req('bookmarks:bulkRemove', {
            items: [{ url: 'https://chatgpt.com/c/1', position: 2 }],
        }));
        expect(bulk?.response.ok).toBe(true);
        expect(store['bookmark:chatgpt.com/c/1:2']).toBeUndefined();
        expect(store['aimd:bookmarks:index:v1']).toEqual(['bookmark:chatgpt.com/c/1:1']);
    });

    it('supports bulk move and exportSelected', async () => {
        const store: StorageMap = {
            folderPaths: ['Import', 'Work'],
            'folder:Import': { path: 'Import', name: 'Import', depth: 1, createdAt: 1, updatedAt: 1 },
            'folder:Work': { path: 'Work', name: 'Work', depth: 1, createdAt: 1, updatedAt: 1 },
        };
        (globalThis as any).browser = createInMemoryBrowser(store);

        const { handleBookmarksRequest } = await import('../../../../src/runtimes/background/handlers/bookmarks');

        await handleBookmarksRequest(req('bookmarks:save', {
            url: 'https://chatgpt.com/c/1',
            position: 1,
            userMessage: 'u1',
            aiResponse: 'a1',
            platform: 'ChatGPT',
            folderPath: 'Import',
            options: { saveContextOnly: false },
        }));
        await handleBookmarksRequest(req('bookmarks:save', {
            url: 'https://chatgpt.com/c/1',
            position: 2,
            userMessage: 'u2',
            aiResponse: 'a2',
            platform: 'ChatGPT',
            folderPath: 'Import',
            options: { saveContextOnly: false },
        }));

        const move = await handleBookmarksRequest(req('bookmarks:bulkMove', {
            items: [{ url: 'https://chatgpt.com/c/1', position: 2 }],
            targetFolderPath: 'Work',
        }));
        expect(move?.response.ok).toBe(true);
        expect(store['bookmark:chatgpt.com/c/1:2'].folderPath).toBe('Work');

        const exported = await handleBookmarksRequest(req('bookmarks:exportSelected', {
            items: [{ url: 'https://chatgpt.com/c/1', position: 2 }],
            preserveStructure: true,
        }));
        expect(exported?.response.ok).toBe(true);
        const payload = (exported as any).response.data.payload;
        expect(payload.version).toBe('3.0');
        expect(payload.bookmarks).toHaveLength(1);
        expect(payload.bookmarks[0].position).toBe(2);
    });

    it('supports bulk move and selected export for page bookmarks', async () => {
        const store: StorageMap = {
            folderPaths: ['Import', 'Pages'],
            'folder:Import': { path: 'Import', name: 'Import', depth: 1, createdAt: 1, updatedAt: 1 },
            'folder:Pages': { path: 'Pages', name: 'Pages', depth: 1, createdAt: 1, updatedAt: 1 },
        };
        (globalThis as any).browser = createInMemoryBrowser(store);

        const { handleBookmarksRequest } = await import('../../../../src/runtimes/background/handlers/bookmarks');

        await handleBookmarksRequest(req('bookmarks:page:save', {
            url: 'https://chatgpt.com/c/page-1',
            title: 'Conversation title',
            platform: 'ChatGPT',
            folderPath: 'Import',
        }));

        const move = await handleBookmarksRequest(req('bookmarks:bulkMove', {
            items: [{ kind: 'page', url: 'https://chatgpt.com/c/page-1' }],
            targetFolderPath: 'Pages',
        }));
        expect(move?.response.ok).toBe(true);
        expect(store['bookmark:page:chatgpt.com/c/page-1'].folderPath).toBe('Pages');

        const exported = await handleBookmarksRequest(req('bookmarks:exportSelected', {
            items: [{ kind: 'page', url: 'https://chatgpt.com/c/page-1' }],
            preserveStructure: true,
        }));
        const payload = (exported as any).response.data.payload;
        expect(payload.bookmarks).toHaveLength(1);
        expect(payload.bookmarks[0]).toMatchObject({ kind: 'page', title: 'Conversation title' });
    });

    it('bulkRemove also removes selected folders and their descendants when folder paths are provided', async () => {
        const store: StorageMap = {
            folderPaths: ['Import', 'Work', 'Work/Research'],
            'folder:Import': { path: 'Import', name: 'Import', depth: 1, createdAt: 1, updatedAt: 1 },
            'folder:Work': { path: 'Work', name: 'Work', depth: 1, createdAt: 1, updatedAt: 1 },
            'folder:Work/Research': { path: 'Work/Research', name: 'Research', depth: 2, createdAt: 1, updatedAt: 1 },
            'bookmark:chatgpt.com/c/1:1': {
                url: 'https://chatgpt.com/c/1',
                urlWithoutProtocol: 'chatgpt.com/c/1',
                position: 1,
                userMessage: 'u1',
                aiResponse: 'a1',
                timestamp: 1,
                title: 'T1',
                platform: 'ChatGPT',
                folderPath: 'Work/Research',
            },
            'bookmark:chatgpt.com/c/1:2': {
                url: 'https://chatgpt.com/c/1',
                urlWithoutProtocol: 'chatgpt.com/c/1',
                position: 2,
                userMessage: 'u2',
                aiResponse: 'a2',
                timestamp: 2,
                title: 'T2',
                platform: 'ChatGPT',
                folderPath: 'Import',
            },
            'aimd:bookmarks:index:v1': ['bookmark:chatgpt.com/c/1:1', 'bookmark:chatgpt.com/c/1:2'],
        };
        (globalThis as any).browser = createInMemoryBrowser(store);

        const { handleBookmarksRequest } = await import('../../../../src/runtimes/background/handlers/bookmarks');

        const bulk = await handleBookmarksRequest(req('bookmarks:bulkRemove', {
            items: [],
            folderPaths: ['Work'],
        }));

        expect(bulk?.response.ok).toBe(true);
        expect(store['bookmark:chatgpt.com/c/1:1']).toBeUndefined();
        expect(store['bookmark:chatgpt.com/c/1:2']).toBeTruthy();
        expect(store['folder:Work']).toBeUndefined();
        expect(store['folder:Work/Research']).toBeUndefined();
        expect(store['folder:Import']).toBeTruthy();
        expect(store['aimd:bookmarks:index:v1']).toEqual(['bookmark:chatgpt.com/c/1:2']);
        expect(store.folderPaths).toEqual(['Import']);
    });

    it('matches large bulk folder removals through a pre-indexed path scope', async () => {
        const count = 500;
        const folderPaths = Array.from({ length: count }, (_, index) => `Folder-${index}`);
        const store: StorageMap = {
            folderPaths,
            'aimd:bookmarks:index:v1': folderPaths.map((_path, index) => `bookmark:chatgpt.com/c/perf:${index + 1}`),
        };
        for (let index = 0; index < count; index += 1) {
            const path = folderPaths[index]!;
            store[`folder:${path}`] = { path, name: path, depth: 1, createdAt: index, updatedAt: index };
            store[`bookmark:chatgpt.com/c/perf:${index + 1}`] = {
                url: 'https://chatgpt.com/c/perf',
                urlWithoutProtocol: 'chatgpt.com/c/perf',
                position: index + 1,
                userMessage: `u${index}`,
                aiResponse: `a${index}`,
                timestamp: index,
                title: `T${index}`,
                platform: 'ChatGPT',
                folderPath: path,
            };
        }
        (globalThis as any).browser = createInMemoryBrowser(store);

        const { handleBookmarksRequest } = await import('../../../../src/runtimes/background/handlers/bookmarks');
        const { PathUtils } = await import('../../../../src/core/bookmarks/path');
        const descendantSpy = vi.spyOn(PathUtils, 'isDescendantOf');

        const bulk = await handleBookmarksRequest(req('bookmarks:bulkRemove', {
            items: [],
            folderPaths,
        }));

        expect(bulk?.response.ok).toBe(true);
        expect(descendantSpy.mock.calls.length).toBeLessThan(count * 10);
        expect(store.folderPaths).toEqual([]);
        expect(store['aimd:bookmarks:index:v1']).toEqual([]);
    });

    it('returns storage usage derived from real local storage bytes and quota', async () => {
        const store: StorageMap = {
            'bookmark:chatgpt.com/c/1:1': {
                url: 'https://chatgpt.com/c/1',
                urlWithoutProtocol: 'chatgpt.com/c/1',
                position: 1,
                userMessage: 'u1',
                aiResponse: 'a1',
                timestamp: 1,
                title: 'T1',
                platform: 'ChatGPT',
                folderPath: 'Import',
            },
        };
        (globalThis as any).browser = createInMemoryBrowser(store);
        (globalThis as any).chrome = { storage: { local: { QUOTA_BYTES: 1024 } } };

        const { handleBookmarksRequest } = await import('../../../../src/runtimes/background/handlers/bookmarks');

        const res = await handleBookmarksRequest(req('bookmarks:storageUsage'));
        expect(res?.response.ok).toBe(true);
        expect((res as any).response.data.usedBytes).toBeGreaterThan(0);
        expect((res as any).response.data.quotaBytes).toBe(1024);
        expect((res as any).response.data.usedPercentage).toBeGreaterThan(0);
    });
});
