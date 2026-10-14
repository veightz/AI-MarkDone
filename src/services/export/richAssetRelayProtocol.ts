import type { RichAssetRelayMetadata, RichAssetRelayRef } from '../../contracts/richContentAssets';
export type { RichAssetRelayMetadata, RichAssetRelayRef } from '../../contracts/richContentAssets';

export const RICH_ASSET_RELAY_VERSION = 1 as const;
export const RICH_ASSET_RELAY_CONNECT = 'aimd:rich-asset-relay:connect' as const;
export const RICH_ASSET_RELAY_LIMITS = Object.freeze({
    chunkBytes: 64 * 1024,
    maxAssetBytes: 8 * 1024 * 1024,
    maxLeaseBytes: 24 * 1024 * 1024,
    maxTotalBytes: 48 * 1024 * 1024,
    maxAssetsPerLease: 128,
    maxLeases: 8,
    maxDimension: 16_384,
    maxPixels: 16_000_000,
});

type CommandBase = Readonly<{
    v: typeof RICH_ASSET_RELAY_VERSION;
    requestId: string;
    leaseId: string;
}>;

export type RichAssetRelayCommand = CommandBase & (
    | Readonly<{ type: 'begin'; asset: RichAssetRelayMetadata }>
    | Readonly<{ type: 'chunk'; assetId: string; sequence: number; bytes: ArrayBuffer }>
    | Readonly<{ type: 'commit'; assetId: string }>
    | Readonly<{ type: 'release' }>
);

export type RichAssetRelayReply = Readonly<{
    v: typeof RICH_ASSET_RELAY_VERSION;
    requestId: string;
}> & (
    | Readonly<{ ok: true; asset?: RichAssetRelayRef }>
    | Readonly<{ ok: false; error: 'INVALID_REQUEST' | 'LIMIT_EXCEEDED' | 'SOURCE_UNAVAILABLE' }>
);

function record(value: unknown): value is Record<string, unknown> {
    return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function identity(value: unknown): value is string {
    return typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9._:-]{0,511}$/.test(value);
}

export function isRichAssetRelayMetadata(value: unknown): value is RichAssetRelayMetadata {
    if (!record(value) || !identity(value.assetId) || !identity(value.blockId)
        || (value.mimeType !== 'image/png' && value.mimeType !== 'image/svg+xml')) return false;
    const { byteLength, widthPx, heightPx } = value;
    return typeof byteLength === 'number' && Number.isInteger(byteLength) && byteLength > 0
        && byteLength <= RICH_ASSET_RELAY_LIMITS.maxAssetBytes
        && typeof widthPx === 'number' && Number.isInteger(widthPx) && widthPx > 0
        && widthPx <= RICH_ASSET_RELAY_LIMITS.maxDimension
        && typeof heightPx === 'number' && Number.isInteger(heightPx) && heightPx > 0
        && heightPx <= RICH_ASSET_RELAY_LIMITS.maxDimension
        && widthPx * heightPx <= RICH_ASSET_RELAY_LIMITS.maxPixels;
}

export function isRichAssetRelayRef(value: unknown, extensionBaseUrl: string): value is RichAssetRelayRef {
    if (!record(value)) return false;
    const objectUrl = value.objectUrl;
    if (!isRichAssetRelayMetadata(value) || typeof objectUrl !== 'string'
        || !/^(?:chrome|moz)-extension:\/\/[^/]+\/$/.test(extensionBaseUrl)) return false;
    const prefix = `blob:${extensionBaseUrl}`;
    return objectUrl.startsWith(prefix) && /^[A-Za-z0-9-]{1,128}$/.test(objectUrl.slice(prefix.length));
}

export function isRichAssetRelayCommand(value: unknown): value is RichAssetRelayCommand {
    if (!record(value) || value.v !== RICH_ASSET_RELAY_VERSION || !identity(value.requestId) || !identity(value.leaseId)) return false;
    if (value.type === 'release') return true;
    if (value.type === 'begin') return isRichAssetRelayMetadata(value.asset);
    if (!identity(value.assetId)) return false;
    if (value.type === 'commit') return true;
    return value.type === 'chunk' && typeof value.sequence === 'number' && Number.isInteger(value.sequence) && value.sequence >= 0
        && Object.prototype.toString.call(value.bytes) === '[object ArrayBuffer]'
        && (value.bytes as ArrayBuffer).byteLength > 0
        && (value.bytes as ArrayBuffer).byteLength <= RICH_ASSET_RELAY_LIMITS.chunkBytes;
}

export function isRichAssetRelayReply(value: unknown, extensionBaseUrl: string): value is RichAssetRelayReply {
    return record(value) && value.v === RICH_ASSET_RELAY_VERSION && identity(value.requestId)
        && (value.ok === true
            ? value.asset === undefined || isRichAssetRelayRef(value.asset, extensionBaseUrl)
            : value.ok === false && ['INVALID_REQUEST', 'LIMIT_EXCEEDED', 'SOURCE_UNAVAILABLE'].includes(String(value.error)));
}

export function richAssetRelayOrigin(url: string): string | null {
    try {
        const parsed = new URL(url);
        return ['chrome-extension:', 'moz-extension:'].includes(parsed.protocol)
            && parsed.host && !parsed.username && !parsed.password ? `${parsed.protocol}//${parsed.host}` : null;
    } catch { return null; }
}

export function isAllowedRichAssetRelayParent(origin: string, ownUrl: string): boolean {
    const ownOrigin = richAssetRelayOrigin(ownUrl);
    return ownOrigin !== null && (origin === ownOrigin || origin === 'https://chatgpt.com' || origin === 'https://chat.openai.com');
}
