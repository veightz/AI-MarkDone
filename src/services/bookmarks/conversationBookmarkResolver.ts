import type { Bookmark } from '../../core/bookmarks/types';
import { getChatGPTConversationId } from '../../contracts/chatgptConversationId';

export type CanonicalBookmarkTurnRef = Readonly<{
    position: number;
    assistantMessageId: string;
}>;

export type ConversationBookmarkResolution =
    | Readonly<{
        kind: 'matched';
        position: number;
        resolvedBy: 'identity' | 'position';
    }>
    | Readonly<{
        kind: 'unavailable';
    }>;

function normalizeMessageId(value: string | null | undefined): string | null {
    const normalized = value?.trim();
    return normalized || null;
}

/**
 * Resolve one persisted bookmark by assistant identity without changing it.
 * The stored ordinal is only a hint and must never mark a different turn.
 */
export function resolveConversationBookmark(
    bookmark: Bookmark,
    turns: readonly CanonicalBookmarkTurnRef[],
): ConversationBookmarkResolution {
    if (bookmark.kind === 'page') return { kind: 'unavailable' };
    const messageId = normalizeMessageId(bookmark.messageId);
    if (!messageId) return { kind: 'unavailable' };
    const matches = turns.filter((turn) => turn.assistantMessageId === messageId);
    return matches.length === 1
        ? { kind: 'matched', position: matches[0]!.position, resolvedBy: 'identity' }
        : { kind: 'unavailable' };
}

export function resolveConversationBookmarkPositions(
    bookmarks: readonly Bookmark[],
    currentUrl: string,
    turns: readonly CanonicalBookmarkTurnRef[],
    isSamePageUrl: (a: string, b: string) => boolean,
): ReadonlySet<number> {
    const resolved = new Set<number>();
    const currentConversationId = getChatGPTConversationId(currentUrl);
    for (const bookmark of bookmarks) {
        if (bookmark.kind === 'page') continue;
        const bookmarkConversationId = getChatGPTConversationId(bookmark.url);
        const sameConversation = currentConversationId && bookmarkConversationId
            ? currentConversationId === bookmarkConversationId
            : isSamePageUrl(bookmark.url, currentUrl);
        if (!sameConversation) continue;
        const result = resolveConversationBookmark(bookmark, turns);
        if (result.kind === 'matched') resolved.add(result.position);
    }
    return resolved;
}
