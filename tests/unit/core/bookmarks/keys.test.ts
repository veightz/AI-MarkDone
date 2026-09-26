import { describe, expect, it } from 'vitest';
import { buildBookmarkStorageKey, buildBookmarkStorageKeyForBookmark, normalizeUrlWithoutProtocol, rememberBookmarkStorageKey } from '../../../../src/core/bookmarks/keys';

describe('bookmarks keys', () => {
    it('normalizes http/https into the same urlWithoutProtocol', () => {
        expect(normalizeUrlWithoutProtocol('https://chatgpt.com/c/1')).toBe('chatgpt.com/c/1');
        expect(normalizeUrlWithoutProtocol('http://chatgpt.com/c/1')).toBe('chatgpt.com/c/1');
    });

    it('buildBookmarkStorageKey keeps schema stable across http/https', () => {
        const a = buildBookmarkStorageKey('https://chatgpt.com/c/key-1', 1);
        const b = buildBookmarkStorageKey('http://chatgpt.com/c/key-1', 1);
        expect(a).toBe('bookmark:chatgpt.com/c/key-1:1');
        expect(b).toBe(a);
    });

    it('uses one v3 key for the same message across project and normal routes', () => {
        const base = {
            urlWithoutProtocol: 'chatgpt.com/c/12345678-1234-1234-1234-123456789abc',
            position: 1,
            messageId: 'assistant-1',
            userMessage: 'Question',
            timestamp: 1,
            title: 'Question',
            platform: 'ChatGPT',
            folderPath: 'Import',
        };
        const direct = buildBookmarkStorageKeyForBookmark({ ...base, url: 'https://chatgpt.com/c/12345678-1234-1234-1234-123456789abc' });
        const project = buildBookmarkStorageKeyForBookmark({ ...base, url: 'https://chatgpt.com/g/project/c/12345678-1234-1234-1234-123456789abc', position: 9 });
        expect(project).toBe(direct);
        expect(direct).toMatch(/^bookmark:message:v3:/);
    });

    it('retains the exact legacy storage key for an existing identified record', () => {
        const url = 'https://chatgpt.com/c/12345678-1234-1234-1234-123456789abc';
        const key = `bookmark:${url.slice(8)}:2`;
        const record = rememberBookmarkStorageKey({ url, urlWithoutProtocol: url.slice(8), position: 2, messageId: 'assistant-2', userMessage: 'Prompt', timestamp: 1, title: 'Prompt', platform: 'ChatGPT', folderPath: 'Import' }, key);
        expect(buildBookmarkStorageKeyForBookmark(record)).toBe(key);
    });
});
