import { describe, expect, it, vi } from 'vitest';
import { PathUtils } from '@/core/bookmarks/path';
import type { Bookmark, Folder } from '@/core/bookmarks/types';
import { BookmarksPanelController } from '@/ui/content/bookmarks/BookmarksPanelController';
import { bookmarkKey, folderKey, getBookmarkIdentityKey } from '@/ui/content/bookmarks/bookmarksPanelControllerHelpers';
import { getSelectedBookmarkItems } from '@/ui/content/bookmarks/bookmarksPanelControllerSelection';

function makeBookmark(index: number, folderPath = `Folder-${index}`): Bookmark {
    return {
        kind: 'message',
        url: `https://chatgpt.com/c/perf-${index}`,
        urlWithoutProtocol: `chatgpt.com/c/perf-${index}`,
        position: index + 1,
        userMessage: `Prompt ${index}`,
        aiResponse: `Answer ${index}`,
        timestamp: index,
        title: `Bookmark ${index}`,
        platform: 'ChatGPT',
        folderPath,
    };
}

function makeFolder(index: number): Folder {
    return {
        path: `Folder-${index}`,
        name: `Folder-${index}`,
        depth: 1,
        createdAt: index,
        updatedAt: index,
    };
}

describe('BookmarksPanelController selection complexity', () => {
    it('selects all matching bookmarks in one state update', () => {
        const controller = new BookmarksPanelController({} as any);
        const records = [makeBookmark(0), makeBookmark(1)];
        const emit = vi.spyOn(controller as any, 'emit');

        controller.selectBookmarks(records);

        expect(controller.getSnapshot().selectedKeys).toEqual(new Set(records.map(record => bookmarkKey(getBookmarkIdentityKey(record)))));
        expect(emit).toHaveBeenCalledOnce();
    });

    it('inverts matching bookmark selection without changing folder selections in one update', () => {
        const controller = new BookmarksPanelController({} as any);
        const first = makeBookmark(0);
        const second = makeBookmark(1);
        (controller as any).state.selectedKeys = new Set([
            bookmarkKey(getBookmarkIdentityKey(first)),
            folderKey('Folder-0'),
        ]);
        const emit = vi.spyOn(controller as any, 'emit');

        controller.invertBookmarkSelection([first, second]);

        expect(controller.getSnapshot().selectedKeys).toEqual(new Set([
            bookmarkKey(getBookmarkIdentityKey(second)),
            folderKey('Folder-0'),
        ]));
        expect(emit).toHaveBeenCalledOnce();
    });

    it('inverts only the supplied result set', () => {
        const controller = new BookmarksPanelController({} as any);
        const records = [makeBookmark(0), makeBookmark(1), makeBookmark(2)];
        controller.selectBookmarks(records.slice(0, 2));

        controller.invertBookmarkSelection(records.slice(0, 2));

        expect(controller.getSnapshot().selectedKeys).toEqual(new Set());
    });

    it('selects same-position message bookmarks by stable message identity', () => {
        const first = { ...makeBookmark(0), url: 'https://chatgpt.com/c/shared-conversation', position: 1, messageId: 'assistant-a' };
        const second = { ...makeBookmark(1), url: first.url, position: first.position, messageId: 'assistant-b' };
        const selectedKeys = new Set([bookmarkKey(getBookmarkIdentityKey(second))]);

        const items = getSelectedBookmarkItems({ bookmarks: [first, second], selectedKeys });

        expect(items).toEqual([{ kind: 'message', url: second.url, position: 1, messageId: 'assistant-b' }]);
    });

    it('resolves a large selected bookmark set with one bookmark index pass', () => {
        const count = 1_500;
        let urlReads = 0;
        const bookmarks = Array.from({ length: count }, (_, index) => {
            const bookmark = makeBookmark(index);
            const url = bookmark.url;
            Object.defineProperty(bookmark, 'url', {
                configurable: true,
                enumerable: true,
                get: () => {
                    urlReads += 1;
                    return url;
                },
            });
            return bookmark;
        });
        const selectedKeys = new Set(
            [...bookmarks].reverse().map((bookmark) => bookmarkKey(getBookmarkIdentityKey(bookmark))),
        );
        urlReads = 0;

        const items = getSelectedBookmarkItems({ bookmarks, selectedKeys });

        expect(items).toHaveLength(count);
        expect(items[0]).toMatchObject({ kind: 'message', position: count });
        expect(urlReads).toBeLessThanOrEqual(count * 2 + 10);
    });

    it('builds all folder checkbox states without rescanning every bookmark for every folder', () => {
        const count = 1_000;
        const controller = new BookmarksPanelController({} as any);
        const folders = Array.from({ length: count }, (_, index) => makeFolder(index));
        const bookmarks = Array.from({ length: count }, (_, index) => makeBookmark(index));
        (controller as any).folders = folders;
        (controller as any).bookmarks = bookmarks;
        (controller as any).state.selectedKeys = new Set(
            bookmarks.filter((_bookmark, index) => index % 2 === 0).map((bookmark) => bookmarkKey(getBookmarkIdentityKey(bookmark))),
        );
        const descendantSpy = vi.spyOn(PathUtils, 'isDescendantOf');

        const states = folders.map((folder) => controller.getFolderCheckboxState(folder.path));

        expect(states.filter((state) => state.checked)).toHaveLength(count / 2);
        expect(descendantSpy.mock.calls.length).toBeLessThan(count * 10);
    });
});
