import type { ReaderSessionAssetsResultV1 } from '../../contracts/protocol';
import type { RichBlockV1 } from '../../contracts/richContent';
import { cloneRichAssetRelayRef } from '../../contracts/richContentAssets';
import { isRichAssetRelayRef, RICH_ASSET_RELAY_LIMITS } from '../export/richAssetRelayProtocol';

export function readReaderSessionAssetResult(
    value: unknown, blocks: readonly RichBlockV1[], extensionBaseUrl: string, expectedLeaseId?: string,
): ReaderSessionAssetsResultV1 | null {
    if (!value || typeof value !== 'object') return null;
    const result = value as Record<string, unknown>;
    if (result.version !== 1 || !Array.isArray(result.refs) || result.refs.length > RICH_ASSET_RELAY_LIMITS.maxAssetsPerLease) return null;
    if (result.leaseId === null) return result.refs.length === 0 ? { version: 1, leaseId: null, refs: [] } : null;
    if (typeof result.leaseId !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,511}$/.test(result.leaseId)
        || (expectedLeaseId !== undefined && result.leaseId !== expectedLeaseId)) return null;
    const ids = new Set(blocks.map(block => block.id));
    const refs = result.refs;
    if (!refs.every(ref => isRichAssetRelayRef(ref, extensionBaseUrl) && ids.has(ref.blockId))
        || new Set(refs.map(ref => ref.assetId)).size !== refs.length
        || new Set(refs.map(ref => ref.blockId)).size !== refs.length
        || refs.reduce((sum, ref) => sum + ref.byteLength, 0) > RICH_ASSET_RELAY_LIMITS.maxLeaseBytes) return null;
    return { version: 1, leaseId: result.leaseId, refs: Object.freeze(refs.map(cloneRichAssetRelayRef)) };
}

export function matchesReaderRichBlockVersions(blocks: readonly RichBlockV1[], versions: readonly { blockId: string; visualDigest: string }[]): boolean {
    return Array.isArray(versions) && versions.length === blocks.length
        && new Set(versions.map(version => version.blockId)).size === versions.length
        && versions.every(version => blocks.some(block => block.id === version.blockId && block.visualDigest === version.visualDigest));
}
