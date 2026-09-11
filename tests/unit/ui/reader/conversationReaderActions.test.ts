import { describe, expect, it, vi } from 'vitest';
import { createConversationReaderActions } from '@/ui/content/reader/conversationReaderActions';

describe('conversation reader actions', () => {
    const locate = {
        locate: vi.fn(async () => ({ ok: true })),
    };

    it('keeps refresh optional while always exposing locate', () => {
        const withoutRefresh = createConversationReaderActions({ locate });
        expect(withoutRefresh.map((action) => action.id)).toEqual(['locate']);

        const withRefresh = createConversationReaderActions({
            locate,
            refresh: { refresh: vi.fn(async () => undefined) },
        });
        expect(withRefresh.map((action) => action.id)).toEqual(['refresh', 'locate']);
    });

    it('adds shared send action only when a send port is provided', () => {
        const withoutSend = createConversationReaderActions({ locate });
        expect(withoutSend.some((action) => action.id === 'send')).toBe(false);

        const withSend = createConversationReaderActions({
            locate,
            send: { open: vi.fn() },
        });
        expect(withSend.map((action) => action.id)).toEqual(['send', 'locate']);
    });

    it('disables and guards the bookmark action when the current Reader item is not bookmarkable', async () => {
        const notify = vi.fn();
        const toggle = vi.fn(async () => ({ ok: true as const, bookmarked: true, message: 'saved' }));
        const bookmark = {
            resolveUrl: () => 'https://chatgpt.com/c/conv-1',
            isBookmarked: () => false,
            isAvailable: vi.fn(() => false),
            toggle,
        };
        const actions = createConversationReaderActions({ locate, bookmark });
        const action = actions.find((candidate) => candidate.id === 'bookmark_toggle')!;
        const ctx = {
            item: {
                id: 'chatgpt-a1',
                userPrompt: 'Question',
                content: 'Answer',
                meta: { position: 0, messageId: 'a1', bookmarkable: false },
            },
            index: 0,
            items: [],
            notify,
            rerender: vi.fn(),
        };

        expect(action.isEnabled?.(ctx)).toBe(false);
        await action.onClick(ctx);

        expect(toggle).not.toHaveBeenCalled();
        expect(notify).toHaveBeenCalledWith('bookmarkUnavailable');
    });

    it('falls back to assistantMessageId when Reader metadata omits messageId', async () => {
        const toggle = vi.fn(async () => ({ ok: true as const, bookmarked: true, message: 'saved' }));
        const bookmark = {
            resolveUrl: () => 'https://chatgpt.com/c/conv-1',
            isBookmarked: () => false,
            toggle,
        };
        const actions = createConversationReaderActions({ locate, bookmark });
        const action = actions.find((candidate) => candidate.id === 'bookmark_toggle')!;

        await action.onClick({
            item: {
                id: 'chatgpt-a1',
                userPrompt: 'Question',
                content: 'Answer',
                meta: { position: 1, assistantMessageId: 'a1' },
            },
            index: 0,
            items: [],
            notify: vi.fn(),
            rerender: vi.fn(),
        });

        expect(toggle).toHaveBeenCalledWith(expect.objectContaining({ messageId: 'a1' }));
    });
});
