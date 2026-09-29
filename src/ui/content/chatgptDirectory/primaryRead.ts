import type { ChatGPTRoundPosition } from './navigation';

export type PrimaryReadCandidate = Readonly<{
    position: number;
    assistantMessageId: string | null;
    assistantRoot: HTMLElement | null;
    top: number;
    bottom: number;
    overlap: number;
    partiallyVisible: boolean;
    distanceToLine: number;
}>;

export type PrimaryReadResolution = Readonly<{
    candidate: PrimaryReadCandidate | null;
    reason: 'overlap' | 'nearest' | 'none';
}>;

export const PRIMARY_READ_REFERENCE_RATIO = 0.35;
export const PRIMARY_READ_HYSTERESIS_MS = 160;
export const PRIMARY_READ_OVERLAP_TIE_RATIO = 0.1;
/** Below this width, prefer viewport-fixed chip (scheme B). */
export const PRIMARY_READ_NARROW_VIEWPORT_PX = 720;

function getAssistantViewportRange(round: ChatGPTRoundPosition): { top: number; bottom: number } | null {
    const node = round.assistantRoot;
    if (!node?.isConnected) return null;
    const rect = node.getBoundingClientRect();
    if (!Number.isFinite(rect.top) || !Number.isFinite(rect.bottom)) return null;
    if (rect.height <= 0 && rect.width <= 0) return null;
    return { top: rect.top, bottom: rect.bottom };
}

function overlapWithLine(top: number, bottom: number, lineY: number, viewportHeight: number): number {
    // Treat a thin band around the reference line as the "reading band".
    const bandHalf = Math.max(12, Math.round(viewportHeight * 0.02));
    const bandTop = lineY - bandHalf;
    const bandBottom = lineY + bandHalf;
    const overlap = Math.min(bottom, bandBottom) - Math.max(top, bandTop);
    return overlap > 0 ? overlap : 0;
}

function distanceToLine(top: number, bottom: number, lineY: number): number {
    if (lineY < top) return top - lineY;
    if (lineY > bottom) return lineY - bottom;
    return 0;
}

/**
 * Resolve the viewport "primary-read" assistant bubble.
 * Candidates: mounted assistant roots only (caller must exclude streaming).
 */
export function resolvePrimaryReadAssistant(
    rounds: readonly ChatGPTRoundPosition[],
    options: {
        referenceY?: number;
        viewportHeight?: number;
        viewportTop?: number;
        viewportBottom?: number;
    } = {},
): PrimaryReadResolution {
    const viewportHeight = options.viewportHeight ?? window.innerHeight;
    const viewportTop = options.viewportTop ?? 0;
    const viewportBottom = options.viewportBottom ?? viewportHeight;
    const referenceY = options.referenceY ?? Math.round(viewportHeight * PRIMARY_READ_REFERENCE_RATIO);

    const candidates: PrimaryReadCandidate[] = [];
    for (const round of rounds) {
        const range = getAssistantViewportRange(round);
        if (!range) continue;
        const partiallyVisible = range.bottom > viewportTop && range.top < viewportBottom;
        if (!partiallyVisible) continue;
        candidates.push({
            position: round.position,
            assistantMessageId: round.assistantMessageId,
            assistantRoot: round.assistantRoot,
            top: range.top,
            bottom: range.bottom,
            overlap: overlapWithLine(range.top, range.bottom, referenceY, viewportHeight),
            partiallyVisible,
            distanceToLine: distanceToLine(range.top, range.bottom, referenceY),
        });
    }

    if (candidates.length === 0) {
        return { candidate: null, reason: 'none' };
    }

    const overlapping = candidates.filter((c) => c.overlap > 0);
    if (overlapping.length > 0) {
        overlapping.sort((a, b) => {
            if (b.overlap !== a.overlap) {
                const larger = Math.max(a.overlap, b.overlap);
                const delta = Math.abs(a.overlap - b.overlap);
                if (larger > 0 && delta / larger < PRIMARY_READ_OVERLAP_TIE_RATIO) {
                    return a.top - b.top; // prefer upper when close
                }
                return b.overlap - a.overlap;
            }
            return a.top - b.top;
        });
        return { candidate: overlapping[0]!, reason: 'overlap' };
    }

    candidates.sort((a, b) => {
        if (a.distanceToLine !== b.distanceToLine) return a.distanceToLine - b.distanceToLine;
        return a.top - b.top;
    });
    return { candidate: candidates[0]!, reason: 'nearest' };
}

export function shouldUseViewportFixedChip(viewportWidth: number = window.innerWidth): boolean {
    return viewportWidth < PRIMARY_READ_NARROW_VIEWPORT_PX;
}
