import { sanitizeLightweightSvg } from '../../drivers/content/export/sanitizeLightweightSvg';
import { cloneRichAssetRelayRef } from '../../contracts/richContentAssets';
import {
    RICH_ASSET_RELAY_CONNECT,
    RICH_ASSET_RELAY_LIMITS,
    RICH_ASSET_RELAY_VERSION,
    isRichAssetRelayCommand,
    isAllowedRichAssetRelayParent,
    type RichAssetRelayCommand,
    type RichAssetRelayMetadata,
    type RichAssetRelayRef,
    type RichAssetRelayReply,
} from '../../services/export/richAssetRelayProtocol';

type StagingAsset = {
    metadata: RichAssetRelayMetadata;
    chunks: ArrayBuffer[];
    received: number;
    nextSequence: number;
};
type Lease = {
    bytes: number;
    staging: Map<string, StagingAsset>;
    ready: Map<string, RichAssetRelayRef>;
};

export class RichAssetRelayHost {
    private readonly leases = new Map<string, Lease>();
    private reservedBytes = 0;

    constructor(private readonly urls: Pick<typeof URL, 'createObjectURL' | 'revokeObjectURL'> = URL) {}

    handle(value: unknown): RichAssetRelayReply | null {
        if (!isRichAssetRelayCommand(value)) return null;
        const base = { v: RICH_ASSET_RELAY_VERSION, requestId: value.requestId } as const;
        try {
            const asset = this.execute(value);
            return { ...base, ok: true, ...(asset ? { asset } : {}) };
        } catch (error) {
            return { ...base, ok: false, error: error instanceof RelayLimitError ? 'LIMIT_EXCEEDED' : 'INVALID_REQUEST' };
        }
    }

    dispose(): void {
        for (const leaseId of this.leases.keys()) this.release(leaseId);
    }

    private execute(command: RichAssetRelayCommand): RichAssetRelayRef | undefined {
        if (command.type === 'release') {
            this.release(command.leaseId);
            return;
        }
        if (command.type === 'begin') {
            const existing = this.leases.get(command.leaseId);
            const lease = existing ?? { bytes: 0, staging: new Map(), ready: new Map() };
            if (lease.staging.has(command.asset.assetId) || lease.ready.has(command.asset.assetId)) throw new Error('Duplicate asset.');
            if ((!existing && this.leases.size >= RICH_ASSET_RELAY_LIMITS.maxLeases)
                || lease.staging.size + lease.ready.size >= RICH_ASSET_RELAY_LIMITS.maxAssetsPerLease
                || lease.bytes + command.asset.byteLength > RICH_ASSET_RELAY_LIMITS.maxLeaseBytes
                || this.reservedBytes + command.asset.byteLength > RICH_ASSET_RELAY_LIMITS.maxTotalBytes) throw new RelayLimitError();
            lease.bytes += command.asset.byteLength;
            this.reservedBytes += command.asset.byteLength;
            const metadata: RichAssetRelayMetadata = {
                assetId: command.asset.assetId, blockId: command.asset.blockId, mimeType: command.asset.mimeType,
                byteLength: command.asset.byteLength, widthPx: command.asset.widthPx, heightPx: command.asset.heightPx,
            };
            lease.staging.set(command.asset.assetId, { metadata, chunks: [], received: 0, nextSequence: 0 });
            this.leases.set(command.leaseId, lease);
            return;
        }
        const lease = this.leases.get(command.leaseId);
        const staging = lease?.staging.get(command.assetId);
        if (!lease || !staging) throw new Error('Asset was not started.');
        if (command.type === 'chunk') {
            if (command.sequence !== staging.nextSequence
                || staging.received + command.bytes.byteLength > staging.metadata.byteLength) throw new Error('Invalid chunk sequence.');
            staging.chunks.push(command.bytes);
            staging.received += command.bytes.byteLength;
            staging.nextSequence += 1;
            return;
        }
        if (staging.received !== staging.metadata.byteLength) throw new Error('Incomplete asset.');
        const bytes = new Uint8Array(staging.received);
        let offset = 0;
        for (const chunk of staging.chunks) {
            bytes.set(new Uint8Array(chunk), offset);
            offset += chunk.byteLength;
        }
        let blob: Blob;
        if (staging.metadata.mimeType === 'image/svg+xml') {
            const svg = sanitizeLightweightSvg(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
            if (svg.kind !== 'ready') throw new Error('Unsafe SVG.');
            if ((svg.width !== undefined && Math.ceil(svg.width) !== staging.metadata.widthPx)
                || (svg.height !== undefined && Math.ceil(svg.height) !== staging.metadata.heightPx)) throw new Error('SVG dimensions differ.');
            blob = new Blob([svg.svg], { type: staging.metadata.mimeType });
        } else {
            assertPngMetadata(bytes, staging.metadata);
            blob = new Blob([bytes], { type: staging.metadata.mimeType });
        }
        const difference = blob.size - staging.metadata.byteLength;
        if (blob.size > RICH_ASSET_RELAY_LIMITS.maxAssetBytes
            || lease.bytes + difference > RICH_ASSET_RELAY_LIMITS.maxLeaseBytes
            || this.reservedBytes + difference > RICH_ASSET_RELAY_LIMITS.maxTotalBytes) throw new RelayLimitError();
        const asset = cloneRichAssetRelayRef({ ...staging.metadata, byteLength: blob.size, objectUrl: this.urls.createObjectURL(blob) });
        lease.bytes += difference;
        this.reservedBytes += difference;
        lease.staging.delete(command.assetId);
        lease.ready.set(command.assetId, asset);
        return asset;
    }

    private release(leaseId: string): void {
        const lease = this.leases.get(leaseId);
        if (!lease) return;
        for (const asset of lease.ready.values()) this.urls.revokeObjectURL(asset.objectUrl);
        this.reservedBytes -= lease.bytes;
        this.leases.delete(leaseId);
    }
}

class RelayLimitError extends Error {}

function assertPngMetadata(bytes: Uint8Array, metadata: RichAssetRelayMetadata): void {
    const signature = [137, 80, 78, 71, 13, 10, 26, 10];
    if (bytes.length < 33 || signature.some((value, index) => bytes[index] !== value)
        || String.fromCharCode(...bytes.slice(12, 16)) !== 'IHDR') throw new Error('Invalid PNG.');
    const header = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    if (header.getUint32(8) !== 13 || header.getUint32(16) !== metadata.widthPx
        || header.getUint32(20) !== metadata.heightPx) throw new Error('PNG dimensions differ.');
}

// The relay is an ephemeral byte owner. It never evaluates host markup, fetches
// resources, or invokes extension APIs; session sender authorization stays in background.
export function installRichAssetRelayHost(target: Window): () => void {
    let host: RichAssetRelayHost | null = null;
    let connectedPort: MessagePort | null = null;
    const connect = (event: MessageEvent<unknown>) => {
        const message = event.data as { v?: unknown; type?: unknown } | null;
        if (host || event.source !== target.parent || !event.ports[0]
            || !isAllowedRichAssetRelayParent(event.origin, target.location.href)
            || message?.v !== RICH_ASSET_RELAY_VERSION || message.type !== RICH_ASSET_RELAY_CONNECT) return;
        host = new RichAssetRelayHost();
        connectedPort = event.ports[0];
        connectedPort.addEventListener('message', (command) => {
            const response = host?.handle(command.data);
            if (response) connectedPort?.postMessage(response);
        });
        connectedPort.start();
    };
    const dispose = () => {
        host?.dispose();
        connectedPort?.close();
        target.removeEventListener('message', connect);
        target.removeEventListener('pagehide', dispose);
    };
    target.addEventListener('message', connect);
    target.addEventListener('pagehide', dispose);
    return dispose;
}

if (typeof window !== 'undefined') installRichAssetRelayHost(window);
