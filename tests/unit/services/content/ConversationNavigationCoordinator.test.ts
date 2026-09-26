import { describe, expect, it, vi } from 'vitest';
import type { ConversationContentStateV1 } from '@/contracts/conversationContent';
import { ConversationNavigationCoordinator } from '@/services/content/ConversationNavigationCoordinator';
import { createConversationContentSource, toConversationSnapshotV1 } from '../../../helpers/chatgptContentFixtures';

function acquiredWhileSyncingState(): ConversationContentStateV1 {
    const snapshot = toConversationSnapshotV1({
        conversationId: '12345678-1234-1234-1234-123456789abc',
        rounds: [{
            id: 'round-1',
            userPrompt: 'Prompt 1',
            assistantContent: 'Answer 1',
            userMessageId: 'user-1',
            assistantMessageId: 'assistant-1',
        }],
    });
    return {
        kind: 'syncing',
        document: snapshot.document,
        snapshot: {
            ...snapshot,
            coverage: 'complete',
            proof: { basis: 'source' },
        },
    };
}

describe('ConversationNavigationCoordinator', () => {
    it('resolves identity to the current canonical position and executes once', async () => {
        const source = createConversationContentSource({
            conversationId: '12345678-1234-1234-1234-123456789abc',
            rounds: [
                { id: 'round-1', userPrompt: 'First', assistantContent: 'A1', userMessageId: 'user-1', assistantMessageId: 'assistant-1' },
                { id: 'round-2', userPrompt: 'Second', assistantContent: 'A2', userMessageId: 'user-2', assistantMessageId: 'assistant-2' },
            ],
        });
        const execute = vi.fn(async () => ({ ok: true as const }));
        const coordinator = new ConversationNavigationCoordinator({ source, execute });

        const result = await coordinator.navigate({
            position: 2,
            messageId: 'assistant-2',
            source: 'directory',
        });

        expect(result).toEqual({
            ok: true,
            phase: 'hydrated',
            resolvedBy: 'identity',
            target: {
                documentKey: 'chatgpt:conversation:12345678-1234-1234-1234-123456789abc',
                position: 2,
                roundId: 'round-2',
                userMessageId: 'user-2',
                assistantMessageId: 'assistant-2',
            },
        });
        expect(execute).toHaveBeenCalledTimes(1);
        expect(execute).toHaveBeenCalledWith(expect.anything(), expect.anything(), 'directory');
    });

    it('does not reuse a page-control execution for a bookmark request to the same target', async () => {
        const source = createConversationContentSource({
            conversationId: '12345678-1234-1234-1234-123456789abc',
            rounds: [{ id: 'round-1', assistantMessageId: 'assistant-1', assistantContent: 'Answer' }],
        });
        const execute = vi.fn(async () => ({ ok: true as const }));
        const coordinator = new ConversationNavigationCoordinator({ source, execute });
        const target = { position: 1, assistantMessageId: 'assistant-1' };
        const directory = coordinator.navigate({ ...target, source: 'directory' });
        const bookmark = coordinator.navigate({ ...target, source: 'bookmark' });

        expect(directory).not.toBe(bookmark);
        expect(await directory).toEqual({ ok: false, reason: 'cancelled' });
        expect((await bookmark).ok).toBe(true);
        expect(execute).toHaveBeenCalledOnce();
        expect(execute).toHaveBeenCalledWith(expect.anything(), expect.anything(), 'bookmark');
    });

    it('follows a bookmark identity after its stored position changes', async () => {
        const source = createConversationContentSource({
            conversationId: '12345678-1234-1234-1234-123456789abc',
            rounds: [
                { id: 'round-1', userPrompt: 'First', assistantContent: 'A1', userMessageId: 'user-1', assistantMessageId: 'assistant-1' },
                { id: 'round-2', userPrompt: 'Second', assistantContent: 'A2', userMessageId: 'user-2', assistantMessageId: 'assistant-2' },
            ],
        });
        const execute = vi.fn(async () => ({ ok: true as const }));
        const coordinator = new ConversationNavigationCoordinator({ source, execute });

        const result = await coordinator.navigate({
            position: 1,
            messageId: 'assistant-2',
            source: 'bookmark',
        });

        expect(result.ok).toBe(true);
        if (result.ok) expect(result.target.position).toBe(2);
        expect(execute).toHaveBeenCalledOnce();
    });

    it('does not reuse a cancelled same-target navigation', async () => {
        const source = createConversationContentSource({
            conversationId: '12345678-1234-1234-1234-123456789abc',
            rounds: [{ id: 'round-1', assistantMessageId: 'assistant-1', assistantContent: 'Answer' }],
        });
        const execute = vi.fn(async (_target, options) => {
            if (options.signal?.aborted) return { ok: false as const, message: 'Navigation cancelled' };
            return { ok: true as const };
        });
        const coordinator = new ConversationNavigationCoordinator({ source, execute });
        const abort = new AbortController();
        const input = { position: 1, assistantMessageId: 'assistant-1', source: 'directory' as const };
        const first = coordinator.navigate(input, { signal: abort.signal });
        abort.abort();
        const second = coordinator.navigate(input);

        expect(second).not.toBe(first);
        expect((await second).ok).toBe(true);
    });

    it('restarts a pending same-target navigation for a fresh user click', async () => {
        const source = createConversationContentSource({
            conversationId: '12345678-1234-1234-1234-123456789abc',
            rounds: [{ id: 'round-1', assistantMessageId: 'assistant-1', assistantContent: 'Answer' }],
        });
        let calls = 0;
        const execute = vi.fn(async (_target, options) => {
            calls += 1;
            if (calls > 1) return { ok: true as const };
            return new Promise<{ ok: false; message: string }>((resolve) => {
                options.signal?.addEventListener('abort', () => resolve({ ok: false, message: 'Navigation cancelled' }), { once: true });
            });
        });
        const coordinator = new ConversationNavigationCoordinator({ source, execute });
        const input = { position: 1, assistantMessageId: 'assistant-1', source: 'directory' as const };
        const first = coordinator.navigate(input);
        await vi.waitFor(() => expect(execute).toHaveBeenCalledOnce());
        const second = coordinator.navigate(input);

        expect(second).not.toBe(first);
        expect(await first).toEqual({ ok: false, reason: 'cancelled' });
        expect((await second).ok).toBe(true);
        expect(execute).toHaveBeenCalledTimes(2);
    });

    it('continues to share an in-flight duplicate bookmark request', async () => {
        const source = createConversationContentSource({
            conversationId: '12345678-1234-1234-1234-123456789abc',
            rounds: [{ id: 'round-1', assistantMessageId: 'assistant-1', assistantContent: 'Answer' }],
        });
        let complete!: (value: { ok: true }) => void;
        const execute = vi.fn(() => new Promise<{ ok: true }>((resolve) => { complete = resolve; }));
        const coordinator = new ConversationNavigationCoordinator({ source, execute });
        const input = { position: 1, assistantMessageId: 'assistant-1', source: 'bookmark' as const };
        const first = coordinator.navigate(input);
        await vi.waitFor(() => expect(execute).toHaveBeenCalledOnce());
        const second = coordinator.navigate(input);

        expect(second).toBe(first);
        complete({ ok: true });
        expect((await second).ok).toBe(true);
    });

    it('does not report an old execution as successful after it was cancelled', async () => {
        const source = createConversationContentSource({
            conversationId: '12345678-1234-1234-1234-123456789abc',
            rounds: [{ id: 'round-1', assistantMessageId: 'assistant-1', assistantContent: 'Answer' }],
        });
        let finish!: (value: { ok: true }) => void;
        const execute = vi.fn(() => new Promise<{ ok: true }>((resolve) => { finish = resolve; }));
        const coordinator = new ConversationNavigationCoordinator({ source, execute });
        const pending = coordinator.navigate({ position: 1, assistantMessageId: 'assistant-1', source: 'directory' });
        await vi.waitFor(() => expect(execute).toHaveBeenCalledOnce());

        coordinator.cancelActive();
        finish({ ok: true });

        expect(await pending).toEqual({ ok: false, reason: 'cancelled' });
    });

    it('follows a Directory message identity when provisional turn ID and ordinal changed', async () => {
        const source = createConversationContentSource({
            conversationId: '12345678-1234-1234-1234-123456789abc',
            rounds: [
                { id: 'prepended-round', assistantMessageId: 'assistant-0', assistantContent: 'Earlier' },
                { id: 'current-round', userMessageId: 'current-user', assistantMessageId: 'assistant-1', assistantContent: 'Answer' },
            ],
        });
        const execute = vi.fn(async () => ({ ok: true as const }));
        const coordinator = new ConversationNavigationCoordinator({ source, execute });

        const result = await coordinator.navigate({
            position: 1,
            roundId: 'provisional-round',
            userMessageId: 'provisional-user',
            assistantMessageId: 'assistant-1',
            source: 'directory',
        }, { timeoutMs: 20 });

        expect(result.ok).toBe(true);
        if (result.ok) expect(result.target).toMatchObject({ position: 2, roundId: 'current-round' });
    });

    it('does not jump to another message for an ID-less legacy bookmark', async () => {
        const snapshot = toConversationSnapshotV1({
            conversationId: '12345678-1234-1234-1234-123456789abc',
            rounds: [{ id: 'round-1', userPrompt: 'First', assistantContent: 'A1', userMessageId: 'user-1', assistantMessageId: 'assistant-1' }],
        });
        const source = createConversationContentSource({ ...snapshot, historyStatus: 'complete' });
        const execute = vi.fn(async () => ({ ok: true as const }));
        const coordinator = new ConversationNavigationCoordinator({ source, execute });

        const result = await coordinator.navigate({ position: 1, source: 'bookmark' });

        expect(result).toEqual({ ok: false, reason: 'source-unavailable' });
        expect(execute).not.toHaveBeenCalled();
    });

    it('does not use position-only fallback while a get source is still unverified', async () => {
        vi.useFakeTimers();
        try {
            const snapshot = toConversationSnapshotV1({
                conversationId: '12345678-1234-1234-1234-123456789abc',
                rounds: [{ id: 'round-1', userPrompt: 'First', assistantContent: 'A1', userMessageId: 'user-1', assistantMessageId: 'assistant-1' }],
            });
            const source = createConversationContentSource({ ...snapshot, historyStatus: 'get' });
            const execute = vi.fn(async () => ({ ok: true as const }));
            const coordinator = new ConversationNavigationCoordinator({ source, execute });
            const resultPromise = coordinator.navigate({ position: 1, source: 'bookmark' }, { timeoutMs: 20 });

            await vi.advanceTimersByTimeAsync(25);
            await expect(resultPromise).resolves.toEqual({ ok: false, reason: 'source-unavailable' });
            expect(execute).not.toHaveBeenCalled();
        } finally {
            vi.useRealTimers();
        }
    });

    it('uses an acquired message immediately even while the route state is syncing', async () => {
        vi.useFakeTimers();
        try {
            const source = createConversationContentSource(acquiredWhileSyncingState());
            const execute = vi.fn(async () => ({ ok: true as const }));
            const coordinator = new ConversationNavigationCoordinator({ source, execute });
            const resultPromise = coordinator.navigate({
                position: 1,
                messageId: 'assistant-1',
                source: 'directory',
            }, { timeoutMs: 1_000 });
            await vi.advanceTimersByTimeAsync(0);

            const result = await resultPromise;
            expect(result.ok).toBe(true);
            expect(execute).toHaveBeenCalledTimes(1);
        } finally {
            vi.useRealTimers();
        }
    });

    it('waits for a late source identity before restoring a bookmark target', async () => {
        const initial = toConversationSnapshotV1({
            conversationId: '12345678-1234-1234-1234-123456789abc',
            rounds: [{ id: 'round-1', userPrompt: 'First', assistantContent: 'A1', userMessageId: 'user-1', assistantMessageId: 'assistant-1' }],
        });
        const source = createConversationContentSource({ ...initial, historyStatus: 'get' });
        const execute = vi.fn(async () => ({ ok: true as const }));
        const coordinator = new ConversationNavigationCoordinator({ source, execute });
        const resultPromise = coordinator.navigate({
            position: 2,
            messageId: 'assistant-2',
            assistantMessageId: 'assistant-2',
            source: 'bookmark',
        }, { timeoutMs: 1_000 });

        await Promise.resolve();
        expect(execute).not.toHaveBeenCalled();

        source.publish({
            ...initial,
            contentToken: 'late-source',
            historyStatus: 'get',
            turns: [
                ...initial.turns,
                {
                    key: 'round-2:assistant-2',
                    ordinal: 2,
                    identity: {
                        turnId: 'round-2',
                        userMessageId: 'user-2',
                        assistantMessageId: 'assistant-2',
                    },
                    userText: 'Second',
                    assistantMarkdown: 'A2',
                },
            ],
        });

        await expect(resultPromise).resolves.toMatchObject({ ok: true, resolvedBy: 'identity' });
        expect(execute).toHaveBeenCalledTimes(1);
    });

    it('does not use a position fallback for a directory target with a missing identity', async () => {
        const source = createConversationContentSource({
            conversationId: '12345678-1234-1234-1234-123456789abc',
            rounds: [{ id: 'round-1', userPrompt: 'First', assistantContent: 'A1', userMessageId: 'user-1', assistantMessageId: 'assistant-1' }],
        });
        const execute = vi.fn(async () => ({ ok: true as const }));
        const coordinator = new ConversationNavigationCoordinator({ source, execute });

        const result = await coordinator.navigate({ position: 1, source: 'directory' });

        expect(result).toEqual({ ok: false, reason: 'source-unavailable' });
        expect(execute).not.toHaveBeenCalled();
    });
});
