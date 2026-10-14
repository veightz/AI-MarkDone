let disposeLoadedAssets: (() => void) | null = null;

/** Register at the capture module boundary, regardless of which UI loaded it. */
export function registerRichContentAssetDisposer(dispose: () => void): void {
    disposeLoadedAssets = dispose;
}

/** This lightweight entry never imports capture capabilities during teardown. */
export function disposeLoadedRichContentAssets(): void {
    disposeLoadedAssets?.();
}
