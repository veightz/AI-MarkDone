import { describe, expect, it, vi } from 'vitest';
import {
    PRIMARY_READ_REFERENCE_RATIO,
    resolvePrimaryReadAssistant,
    shouldUseViewportFixedChip,
} from '@/ui/content/chatgptDirectory/primaryRead';
import type { ChatGPTRoundPosition } from '@/ui/content/chatgptDirectory/navigation';

function round(position: number, top: number, bottom: number, streaming = false): ChatGPTRoundPosition {
    const el = document.createElement('div');
    el.dataset.streaming = streaming ? '1' : '0';
    el.getBoundingClientRect = vi.fn(() => ({
        x: 0,
        y: top,
        top,
        bottom,
        left: 0,
        right: 320,
        width: 320,
        height: bottom - top,
        toJSON: () => ({}),
    }));
    document.body.appendChild(el);
    return {
        position,
        id: `round-${position}`,
        messageId: `a-${position}`,
        roundId: `round-${position}`,
        userMessageId: `u-${position}`,
        assistantMessageId: `a-${position}`,
        userPromptText: `p${position}`,
        jumpAnchor: el,
        userAnchor: el,
        assistantRoot: el,
        groupEls: [el],
    };
}

describe('resolvePrimaryReadAssistant', () => {
    it('picks the assistant with max overlap on the 35% reference line', () => {
        const height = 1000;
        const line = Math.round(height * PRIMARY_READ_REFERENCE_RATIO);
        const rounds = [
            round(1, 0, line - 40),
            round(2, line - 80, line + 120),
            round(3, line + 100, height),
        ];
        const result = resolvePrimaryReadAssistant(rounds, {
            referenceY: line,
            viewportHeight: height,
        });
        expect(result.reason).toBe('overlap');
        expect(result.candidate?.position).toBe(2);
    });

    it('prefers the upper bubble when overlap area is nearly tied', () => {
        const height = 1000;
        const line = 350;
        const rounds = [
            round(1, 250, 450),
            round(2, 300, 500),
        ];
        const result = resolvePrimaryReadAssistant(rounds, {
            referenceY: line,
            viewportHeight: height,
        });
        expect(result.candidate?.position).toBe(1);
    });

    it('hides when no assistant is visible', () => {
        const rounds = [round(1, -400, -100)];
        const result = resolvePrimaryReadAssistant(rounds, {
            referenceY: 350,
            viewportHeight: 1000,
            viewportTop: 0,
            viewportBottom: 1000,
        });
        expect(result.reason).toBe('none');
        expect(result.candidate).toBeNull();
    });

    it('uses nearest partially visible assistant when none cross the line', () => {
        const rounds = [
            round(1, 10, 80),
            round(2, 900, 980),
        ];
        const result = resolvePrimaryReadAssistant(rounds, {
            referenceY: 350,
            viewportHeight: 1000,
        });
        expect(result.reason).toBe('nearest');
        expect(result.candidate?.position).toBe(1);
    });
});

describe('shouldUseViewportFixedChip', () => {
    it('falls back to viewport-fixed on narrow screens', () => {
        expect(shouldUseViewportFixedChip(719)).toBe(true);
        expect(shouldUseViewportFixedChip(720)).toBe(false);
    });
});
