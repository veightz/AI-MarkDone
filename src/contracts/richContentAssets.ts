export type RichAssetRelayMetadata = Readonly<{
    assetId: string;
    blockId: string;
    mimeType: 'image/svg+xml' | 'image/png';
    byteLength: number;
    widthPx: number;
    heightPx: number;
}>;

/** JSON-only session capability; its backing bytes remain in the source page's extension relay. */
export type RichAssetRelayRef = RichAssetRelayMetadata & Readonly<{ objectUrl: string }>;

export function cloneRichAssetRelayRef(ref: RichAssetRelayRef): RichAssetRelayRef {
    return Object.freeze({
        assetId: ref.assetId,
        blockId: ref.blockId,
        mimeType: ref.mimeType,
        byteLength: ref.byteLength,
        widthPx: ref.widthPx,
        heightPx: ref.heightPx,
        objectUrl: ref.objectUrl,
    });
}
