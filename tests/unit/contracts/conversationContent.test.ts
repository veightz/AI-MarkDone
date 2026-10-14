import { describe, expect, it } from 'vitest';
import { richSvgBlock } from '../../helpers/richContentFixtures';

import {
    createConversationDocumentKeyV1,
    createConversationPageDocumentKeyV1,
    freezeConversationSnapshotV1,
    isConversationDocumentRefV1,
    isConversationSnapshotV1,
    type ConversationSnapshotV1,
} from '../../../src/contracts/conversationContent';

function createSnapshot(overrides: Partial<ConversationSnapshotV1> = {}): ConversationSnapshotV1 {
    const document = {
        key: createConversationDocumentKeyV1('chatgpt', 'conversation-1'),
        platformId: 'chatgpt',
        conversationId: 'conversation-1',
        title: 'A conversation',
        canonicalUrl: 'https://chatgpt.com/c/conversation-1#turn-2',
    } as const;
    return {
        schemaVersion: 1,
        document,
        contentToken: 'content-1',
        coverage: 'complete',
        turns: [
            {
                key: 'turn-1',
                ordinal: 1,
                identity: {
                    turnId: 'turn-1',
                    userMessageId: 'user-1',
                    assistantMessageId: 'assistant-1',
                },
                userText: 'Question',
                assistantMarkdown: 'Answer',
            },
        ],
        ...overrides,
    };
}

describe('Conversation Content Port V1 contract', () => {
    it('creates a stable document key from normalized platform and conversation identity', () => {
        expect(createConversationDocumentKeyV1(' ChatGPT ', ' conversation/1 '))
            .toBe('chatgpt:conversation:conversation%2F1');
        expect(createConversationDocumentKeyV1('chatgpt', 'CONVERSATION-1'))
            .toBe('chatgpt:conversation:conversation-1');
    });

    it('accepts a valid document reference only when its key matches its identity', () => {
        const document = createSnapshot().document;
        expect(isConversationDocumentRefV1(document)).toBe(true);
        expect(isConversationDocumentRefV1({
            ...document,
            key: 'chatgpt:conversation:other',
        })).toBe(false);
    });

    it('represents a page-scoped conversation without inventing a canonical conversation id', () => {
        const document = {
            key: createConversationPageDocumentKeyV1('chatgpt', 'page-epoch-1'),
            platformId: 'chatgpt',
            identityKind: 'page',
            conversationId: null,
            canonicalUrl: 'https://chatgpt.com/',
        } as const;

        expect(isConversationDocumentRefV1(document)).toBe(true);
        expect(isConversationDocumentRefV1({
            ...document,
            conversationId: 'invented-id',
        })).toBe(false);
    });

    it('requires unique, contiguous turn identity and ordinal values', () => {
        expect(isConversationSnapshotV1(createSnapshot())).toBe(true);
        expect(isConversationSnapshotV1(createSnapshot({
            turns: [{
                ...createSnapshot().turns[0],
                ordinal: 2,
            }],
        }))).toBe(false);
        expect(isConversationSnapshotV1(createSnapshot({
            turns: [
                ...createSnapshot().turns,
                { ...createSnapshot().turns[0], key: 'turn-2', ordinal: 2 },
            ],
        }))).toBe(false);
    });

    it('deep-freezes the published semantic snapshot', () => {
        const frozen = freezeConversationSnapshotV1(createSnapshot());
        expect(Object.isFrozen(frozen)).toBe(true);
        expect(Object.isFrozen(frozen.document)).toBe(true);
        expect(Object.isFrozen(frozen.turns)).toBe(true);
        expect(Object.isFrozen(frozen.turns[0])).toBe(true);
        expect(Object.isFrozen(frozen.turns[0].identity)).toBe(true);
        expect(() => {
            (frozen.turns[0] as { assistantMarkdown: string }).assistantMarkdown = 'changed';
        }).toThrow();
    });

    it('clones and freezes rich sources without freezing or retaining caller-owned objects', () => {
        const source = { kind: 'svg' as const, svg: '<svg><rect fill="red"/></svg>' };
        const block = richSvgBlock({ source });
        const snapshot = createSnapshot();
        const frozen = freezeConversationSnapshotV1({ ...snapshot, turns: [{ ...snapshot.turns[0]!, assistantRichBlocks: [block] }] });
        const captured = frozen.turns[0]?.assistantRichBlocks;
        expect(captured).toEqual([block]);
        expect(captured?.[0]).not.toBe(block);
        expect(captured?.[0]?.source).not.toBe(source);
        expect(Object.isFrozen(captured)).toBe(true);
        expect(Object.isFrozen(captured?.[0]?.source)).toBe(true);
        source.svg = '<svg><rect fill="blue"/></svg>';
        expect(captured?.[0]?.source).toMatchObject({ svg: '<svg><rect fill="red"/></svg>' });
    });

    it('rejects invalid rich sidecars before admitting a snapshot', () => {
        const snapshot = createSnapshot();
        const withBlocks = (assistantRichBlocks: unknown) => ({ ...snapshot, turns: [{ ...snapshot.turns[0], assistantRichBlocks }] });
        expect(isConversationSnapshotV1(withBlocks([richSvgBlock()]))).toBe(true);
        expect(isConversationSnapshotV1(withBlocks([{ ...richSvgBlock(), source: { kind: 'svg', svg: 5 } }]))).toBe(false);
        expect(isConversationSnapshotV1(withBlocks([richSvgBlock(), richSvgBlock()]))).toBe(false);
    });

    it('requires every published snapshot to be complete and dense', () => {
        expect(isConversationSnapshotV1(createSnapshot({ coverage: 'partial' } as never))).toBe(false);
        expect(isConversationSnapshotV1(createSnapshot({
            turns: [{
                ...createSnapshot().turns[0],
                ordinal: 7,
            }],
        }))).toBe(false);
        expect(isConversationSnapshotV1(createSnapshot({
            turns: [{
                ...createSnapshot().turns[0],
                identity: {
                    ...createSnapshot().turns[0].identity,
                    assistantMessageId: '',
                },
            }],
        }))).toBe(false);
    });

    it('accepts get as a usable but not complete history status', () => {
        expect(isConversationSnapshotV1(createSnapshot({ historyStatus: 'get' }))).toBe(true);
    });
});
