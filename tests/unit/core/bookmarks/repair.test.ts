import { describe, expect, it } from 'vitest';
import { buildRepairPlan } from '../../../../src/core/bookmarks/repair';

describe('bookmarks repair', () => {
    it('repairs partial records and quarantines irreparable records', () => {
        const now = Date.now();
        const rawStorage: Record<string, unknown> = {
            'bookmark:chatgpt.com/c/r1:1': {
                url: 'https://chatgpt.com/c/r1',
                position: 1,
                messageId: 'assistant-1',
                userMessage: 'u',
                timestamp: now,
            },
            'bookmark:chatgpt.com/c/r2:2': {
                url: 'https://chatgpt.com/c/r2',
                messageId: 'assistant-2',
                // missing position/userMessage/timestamp
            },
            'bookmark:bad:3': 'corrupted',
            'folder:Import': { path: 'Import' },
        };

        const plan = buildRepairPlan({ rawStorage, now });

        expect(plan.stats.examined).toBe(3);
        expect(plan.stats.repaired).toBe(2); // r1 + r2 become normalized records
        expect(plan.stats.removed).toBe(1);  // irreparable entry removed
        expect(plan.quarantine).toHaveLength(1);
        expect(plan.removeKeys).toEqual(['bookmark:bad:3']);
        expect(plan.setPatch['bookmark:chatgpt.com/c/r1:1']).toBeTruthy();
        expect(plan.setPatch['bookmark:chatgpt.com/c/r1:1']?.messageId).toBe('assistant-1');
        expect(plan.setPatch['bookmark:chatgpt.com/c/r2:2']?.messageId).toBe('assistant-2');
    });

    it('recognizes a v3 identity key and restores a missing message ID only when the URL agrees', () => {
        const url = 'https://chatgpt.com/c/12345678-1234-1234-1234-123456789abc';
        const key = 'bookmark:message:v3:12345678-1234-1234-1234-123456789abc:assistant-1';
        const plan = buildRepairPlan({
            now: 2,
            rawStorage: { [key]: { url, position: 1, userMessage: 'Prompt', timestamp: 1 } },
        });

        expect(plan.setPatch[key]).toMatchObject({ messageId: 'assistant-1', urlWithoutProtocol: url.slice(8) });
        expect(plan.removeKeys).toEqual([]);
    });
});
