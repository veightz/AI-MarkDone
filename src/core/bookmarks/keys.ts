import type { Bookmark } from './types';
import { getChatGPTConversationId } from '../../contracts/chatgptConversationId';

const PROTOCOL_PATTERN = /^https?:\/\//;
const storedKeys = new WeakMap<Bookmark, string>();

export function rememberBookmarkStorageKey(bookmark: Bookmark, key: string): Bookmark {
    storedKeys.set(bookmark, key);
    return bookmark;
}

export function buildBookmarkMessageStorageKey(url: string, messageId: string): string | null {
    const conversationId = getChatGPTConversationId(url);
    const id = messageId.trim();
    return conversationId && id
        ? `bookmark:message:v3:${encodeURIComponent(conversationId)}:${encodeURIComponent(id)}`
        : null;
}

export function readBookmarkMessageStorageKey(key: string): { conversationId: string; messageId: string } | null {
    const prefix = 'bookmark:message:v3:';
    if (!key.startsWith(prefix)) return null;
    const separator = key.indexOf(':', prefix.length);
    if (separator < 0) return null;
    try {
        const conversationId = decodeURIComponent(key.slice(prefix.length, separator));
        const messageId = decodeURIComponent(key.slice(separator + 1));
        return conversationId && messageId ? { conversationId, messageId } : null;
    } catch {
        return null;
    }
}

export function buildBookmarkDedupeKey(bookmark: Bookmark): string {
    if (bookmark.kind === 'page') return buildPageBookmarkIdentityKey(bookmark.url);
    const identity = bookmark.messageId && buildBookmarkMessageStorageKey(bookmark.url, bookmark.messageId);
    return identity ?? buildBookmarkIdentityKey(bookmark.url, bookmark.position ?? 0);
}

export function normalizeUrlWithoutProtocol(url: string): string {
    return (url || '').replace(PROTOCOL_PATTERN, '');
}

export function buildBookmarkStorageKey(url: string, position: number): string {
    const urlWithoutProtocol = normalizeUrlWithoutProtocol(url);
    return `bookmark:${urlWithoutProtocol}:${position}`;
}

export function buildPageBookmarkStorageKey(url: string): string {
    const urlWithoutProtocol = normalizeUrlWithoutProtocol(url);
    return `bookmark:page:${urlWithoutProtocol}`;
}

export function buildBookmarkIdentityKey(url: string, position: number): string {
    const urlWithoutProtocol = normalizeUrlWithoutProtocol(url);
    return `message:${urlWithoutProtocol}:${position}`;
}

export function buildPageBookmarkIdentityKey(url: string): string {
    const urlWithoutProtocol = normalizeUrlWithoutProtocol(url);
    return `page:${urlWithoutProtocol}`;
}

export function buildBookmarkIdentityKeyFromParts(parts: {
    url?: string;
    urlWithoutProtocol?: string;
    position?: number;
    kind?: 'message' | 'page';
}): string {
    const normalized = parts.urlWithoutProtocol || normalizeUrlWithoutProtocol(parts.url || '');
    if (parts.kind === 'page') return `page:${normalized}`;
    return `message:${normalized}:${parts.position ?? 0}`;
}

export function buildBookmarkStorageKeyForBookmark(bookmark: Bookmark): string {
    const original = storedKeys.get(bookmark);
    if (original) return original;
    if (bookmark.kind === 'page') return buildPageBookmarkStorageKey(bookmark.url);
    if (bookmark.messageId) {
        const identity = buildBookmarkMessageStorageKey(bookmark.url, bookmark.messageId);
        if (identity) return identity;
    }
    return buildBookmarkStorageKey(bookmark.url, bookmark.position ?? 0);
}

export function buildBookmarkIdentityKeyForBookmark(bookmark: Bookmark): string {
    if (bookmark.kind === 'page') return buildPageBookmarkIdentityKey(bookmark.url);
    return buildBookmarkIdentityKey(bookmark.url, bookmark.position ?? 0);
}
