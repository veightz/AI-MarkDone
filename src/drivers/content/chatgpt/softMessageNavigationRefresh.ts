import type { ConversationSurfaceFrameV1, ConversationSurfacePortV1 } from '../../../contracts/conversationSurface';
import {
    readChatGPTOfficialNavigation,
    type ChatGPTOfficialNavigationSnapshot,
} from './ChatGPTOfficialNavigation';

/**
 * Enough of a surface frame to see whether the existing projection is mounted.
 * This is not a parser: it only reads the PageIndex/Discovery join already
 * published on the surface, plus the official navigation skeleton count.
 */
export type MessageNavigationGapFrame = {
    obtainedTurns: ReadonlyArray<{
        materialization: { jumpAnchorElement: { isConnected: boolean } } | null;
    }>;
    pendingSurfaces?: ReadonlyArray<{
        materialization: { jumpAnchorElement: { isConnected: boolean } };
    }>;
};

export type SoftMessageNavigationRefreshInput = {
    /** Shared PageIndex. `refreshSurface` invalidates it again before rebuild. */
    pageIndex?: { invalidate(): void } | null;
    surface: Pick<ConversationSurfacePortV1, 'refreshSurface' | 'readFrame'>;
    readOfficialNavigation?: () => ChatGPTOfficialNavigationSnapshot;
};

function isMounted(anchor: { isConnected: boolean } | null | undefined): boolean {
    return Boolean(anchor?.isConnected);
}

/**
 * True when a soft rescan cannot cover turns the current projection or the
 * official navigation skeleton already knows about. Those turns are still
 * virtualized (not mounted). A partial history with every known turn mounted
 * is not a gap: the scan reused the existing projection.
 */
export function messageNavigationHasUnmountedGaps(
    frame: MessageNavigationGapFrame,
    official: ChatGPTOfficialNavigationSnapshot,
): boolean {
    let mounted = 0;
    for (const turn of frame.obtainedTurns) {
        if (isMounted(turn.materialization?.jumpAnchorElement)) mounted += 1;
        else return true;
    }
    for (const pending of frame.pendingSurfaces ?? []) {
        if (isMounted(pending.materialization.jumpAnchorElement)) mounted += 1;
    }
    return official.ready && official.expectedTurnCount > mounted;
}

/**
 * Rescan the already-mounted DOM and rejoin it to the existing round projection.
 * Does not reload the page, drop conversation state, or parse new HTML.
 * Message nav and the directory outline recompute from the refreshed frame.
 */
export function softRefreshChatGPTMessageNavigation(
    input: SoftMessageNavigationRefreshInput,
): { gaps: boolean; frame: ConversationSurfaceFrameV1 } {
    input.pageIndex?.invalidate();
    input.surface.refreshSurface();
    const frame = input.surface.readFrame();
    const official = (input.readOfficialNavigation ?? readChatGPTOfficialNavigation)();
    return {
        gaps: messageNavigationHasUnmountedGaps(frame, official),
        frame,
    };
}
