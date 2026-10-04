import { describe, expect, it, vi } from 'vitest';
import {
    messageNavigationHasUnmountedGaps,
    softRefreshChatGPTMessageNavigation,
} from '@/drivers/content/chatgpt/softMessageNavigationRefresh';

const none = { ready: false, expectedTurnCount: 0 } as const;

describe('softRefreshChatGPTMessageNavigation', () => {
    it('treats a fully mounted projection as complete', () => {
        const anchor = document.createElement('div');
        document.body.appendChild(anchor);
        expect(messageNavigationHasUnmountedGaps({
            obtainedTurns: [{ materialization: { jumpAnchorElement: anchor } }],
            pendingSurfaces: [],
        }, { ready: true, expectedTurnCount: 1 })).toBe(false);
        anchor.remove();
    });

    it('reports a gap when a projected turn is not mounted', () => {
        const anchor = document.createElement('div');
        expect(messageNavigationHasUnmountedGaps({
            obtainedTurns: [{ materialization: { jumpAnchorElement: anchor } }],
        }, none)).toBe(true);
    });

    it('reports a gap when official navigation expects more turns than are mounted', () => {
        const anchor = document.createElement('div');
        document.body.appendChild(anchor);
        expect(messageNavigationHasUnmountedGaps({
            obtainedTurns: [{ materialization: { jumpAnchorElement: anchor } }],
            pendingSurfaces: [],
        }, { ready: true, expectedTurnCount: 3 })).toBe(true);
        anchor.remove();
    });

    it('invalidates PageIndex and refreshes the surface without replacing the projection', () => {
        const pageIndex = { invalidate: vi.fn() };
        const frame = {
            frameToken: 'frame',
            surfaceToken: 'surface',
            contentKind: 'ready' as const,
            document: null,
            snapshot: { projectionId: 'kept-projection' },
            projectionId: 'kept-projection',
            contentToken: 'content',
            obtainedTurns: [],
            pendingSurfaces: [],
        };
        const surface = {
            refreshSurface: vi.fn(),
            readFrame: () => frame,
        };
        const result = softRefreshChatGPTMessageNavigation({
            pageIndex,
            surface: surface as any,
            readOfficialNavigation: () => none,
        });
        expect(pageIndex.invalidate).toHaveBeenCalledTimes(1);
        expect(surface.refreshSurface).toHaveBeenCalledTimes(1);
        expect(result.gaps).toBe(false);
        expect(result.frame.projectionId).toBe('kept-projection');
    });
});
