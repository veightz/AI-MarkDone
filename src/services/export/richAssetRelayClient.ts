import { extensionAssets } from '../../../config/extension/assets';
import { browser } from '../../drivers/shared/browser';
import { cloneRichAssetRelayRef } from '../../contracts/richContentAssets';
import {
    RICH_ASSET_RELAY_CONNECT,
    RICH_ASSET_RELAY_LIMITS,
    RICH_ASSET_RELAY_VERSION,
    isRichAssetRelayMetadata,
    isRichAssetRelayReply,
    richAssetRelayOrigin,
    type RichAssetRelayCommand,
    type RichAssetRelayMetadata,
    type RichAssetRelayRef,
    type RichAssetRelayReply,
} from './richAssetRelayProtocol';

export type RichAssetRelayInput = Readonly<{
    assetId: string;
    blockId: string;
    mimeType: RichAssetRelayMetadata['mimeType'];
    blob: Blob;
    widthPx: number;
    heightPx: number;
}>;

export type RichAssetRelayLease = Readonly<{
    leaseId: string;
    refs: readonly RichAssetRelayRef[];
    release: () => Promise<void>;
}>;

export type RichAssetRelayConnection = Readonly<{
    port: MessagePort;
    extensionBaseUrl: string;
    teardown: () => void;
}>;

type Payload =
    | { type: 'begin'; asset: RichAssetRelayMetadata }
    | { type: 'chunk'; assetId: string; sequence: number; bytes: ArrayBuffer }
    | { type: 'commit'; assetId: string }
    | { type: 'release' };

type Pending = {
    resolve: (reply: RichAssetRelayReply) => void;
    reject: (error: Error) => void;
    cleanup: () => void;
};

function abortError(): DOMException {
    return new DOMException('Asset preparation cancelled.', 'AbortError');
}

function checkSignal(signal?: AbortSignal): void {
    if (signal?.aborted) throw abortError();
}

export class RichAssetRelayClient {
    private connection: RichAssetRelayConnection | null = null;
    private connecting: Promise<RichAssetRelayConnection> | null = null;
    private readonly leases = new Set<string>();
    private readonly pending = new Map<string, Pending>();
    private sequence = 0;
    private disposed = false;

    constructor(private readonly connect: () => Promise<RichAssetRelayConnection> = connectRelayIframe) {}

    async retainAssets(
        assets: readonly RichAssetRelayInput[],
        options: { leaseId?: string; signal?: AbortSignal } = {},
    ): Promise<RichAssetRelayLease> {
        checkSignal(options.signal);
        if (this.disposed) throw new Error('Asset relay is disposed.');
        const leaseId = options.leaseId ?? crypto.randomUUID();
        if (this.leases.has(leaseId) || !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,511}$/.test(leaseId)) throw new Error('Invalid or duplicate asset lease.');
        if (assets.length > RICH_ASSET_RELAY_LIMITS.maxAssetsPerLease
            || assets.reduce((total, asset) => total + asset.blob.size, 0) > RICH_ASSET_RELAY_LIMITS.maxLeaseBytes
            || new Set(assets.map(asset => asset.assetId)).size !== assets.length) throw new Error('Asset lease exceeds its budget.');
        for (const asset of assets) {
            if (asset.blob.type !== asset.mimeType || !isRichAssetRelayMetadata({ ...asset, byteLength: asset.blob.size })) throw new Error('Invalid asset metadata.');
        }
        this.leases.add(leaseId);
        try {
            const refs: RichAssetRelayRef[] = [];
            if (assets.length > 0) await abortable(this.ensureConnection(), options.signal);
            for (const asset of assets) {
                checkSignal(options.signal);
                const metadata: RichAssetRelayMetadata = {
                    assetId: asset.assetId, blockId: asset.blockId, mimeType: asset.mimeType,
                    byteLength: asset.blob.size, widthPx: asset.widthPx, heightPx: asset.heightPx,
                };
                await this.request(leaseId, { type: 'begin', asset: metadata }, options.signal);
                const bytes = await readBlobBytes(asset.blob);
                checkSignal(options.signal);
                let sequence = 0;
                for (let offset = 0; offset < bytes.byteLength; offset += RICH_ASSET_RELAY_LIMITS.chunkBytes) {
                    const chunk = bytes.slice(offset, offset + RICH_ASSET_RELAY_LIMITS.chunkBytes);
                    await this.request(leaseId, { type: 'chunk', assetId: asset.assetId, sequence: sequence++, bytes: chunk }, options.signal);
                }
                const committed = await this.request(leaseId, { type: 'commit', assetId: asset.assetId }, options.signal);
                if (!committed.ok || !committed.asset || committed.asset.assetId !== asset.assetId
                    || committed.asset.blockId !== asset.blockId || committed.asset.mimeType !== asset.mimeType
                    || committed.asset.widthPx !== asset.widthPx || committed.asset.heightPx !== asset.heightPx) throw new Error('Asset relay returned mismatched metadata.');
                refs.push(cloneRichAssetRelayRef(committed.asset));
            }
            checkSignal(options.signal);
            return Object.freeze({ leaseId, refs: Object.freeze(refs), release: () => this.releaseLease(leaseId) });
        } catch (error) {
            await this.releaseLease(leaseId).catch(() => undefined);
            throw error;
        }
    }

    async releaseLease(leaseId: string): Promise<void> {
        if (!this.leases.delete(leaseId)) return;
        try {
            if (this.connection) await this.request(leaseId, { type: 'release' });
        } catch (error) {
            this.leases.clear();
            this.disconnect();
            throw error;
        } finally {
            if (this.leases.size === 0) this.disconnect();
        }
    }

    dispose(): void {
        this.disposed = true;
        this.leases.clear();
        this.disconnect();
    }

    private async ensureConnection(): Promise<RichAssetRelayConnection> {
        if (this.connection) return this.connection;
        if (this.connecting) return this.connecting;
        this.connecting = this.connect().then(connection => {
            if (this.disposed || this.leases.size === 0) {
                connection.port.close();
                connection.teardown();
                throw abortError();
            }
            this.connection = connection;
            connection.port.addEventListener('message', this.receive);
            connection.port.start();
            return connection;
        }).finally(() => { this.connecting = null; });
        return this.connecting;
    }

    private readonly receive = (event: MessageEvent<unknown>): void => {
        const data = event.data as { requestId?: unknown } | null;
        if (!data || typeof data.requestId !== 'string') return;
        const pending = this.pending.get(data.requestId);
        if (!pending) return;
        pending.cleanup();
        if (!this.connection || !isRichAssetRelayReply(event.data, this.connection.extensionBaseUrl)) {
            pending.reject(new Error('Asset relay returned an invalid response.'));
            return;
        }
        if (!event.data.ok) pending.reject(new Error(`Asset relay failed: ${event.data.error}`));
        else pending.resolve(event.data);
    };

    private request(leaseId: string, payload: Payload, signal?: AbortSignal): Promise<RichAssetRelayReply> {
        checkSignal(signal);
        const connection = this.connection;
        if (!connection) return Promise.reject(new Error('Asset relay is disconnected.'));
        const requestId = `asset-${++this.sequence}`;
        return new Promise((resolve, reject) => {
            const cleanup = () => {
                clearTimeout(timer);
                signal?.removeEventListener('abort', cancel);
                this.pending.delete(requestId);
            };
            const cancel = () => { cleanup(); reject(abortError()); };
            const timer = setTimeout(() => { cleanup(); reject(new Error('Asset relay request timed out.')); }, 5_000);
            this.pending.set(requestId, { resolve, reject, cleanup });
            signal?.addEventListener('abort', cancel, { once: true });
            try {
                const command: RichAssetRelayCommand = { v: RICH_ASSET_RELAY_VERSION, requestId, leaseId, ...payload };
                connection.port.postMessage(command, payload.type === 'chunk' ? [payload.bytes] : []);
            } catch (error) {
                cleanup();
                reject(error);
            }
        });
    }

    private disconnect(): void {
        for (const pending of this.pending.values()) {
            pending.cleanup();
            pending.reject(new Error('Asset relay disconnected.'));
        }
        if (!this.connection) return;
        this.connection.port.removeEventListener('message', this.receive);
        this.connection.port.close();
        this.connection.teardown();
        this.connection = null;
    }
}

async function readBlobBytes(blob: Blob): Promise<ArrayBuffer> {
    if (typeof blob.arrayBuffer === 'function') return blob.arrayBuffer();
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = () => reject(reader.error ?? new Error('Asset bytes are unavailable.'));
        reader.onload = () => resolve(reader.result as ArrayBuffer);
        reader.readAsArrayBuffer(blob);
    });
}

function abortable<T>(promise: Promise<T>, signal?: AbortSignal): Promise<T> {
    checkSignal(signal);
    return new Promise((resolve, reject) => {
        const cancel = () => { signal?.removeEventListener('abort', cancel); reject(abortError()); };
        signal?.addEventListener('abort', cancel, { once: true });
        promise.then(value => { signal?.removeEventListener('abort', cancel); resolve(value); }, error => { signal?.removeEventListener('abort', cancel); reject(error); });
    });
}

function connectRelayIframe(): Promise<RichAssetRelayConnection> {
    return new Promise((resolve, reject) => {
        const extensionBaseUrl = browser.runtime.getURL('');
        const targetOrigin = richAssetRelayOrigin(extensionBaseUrl);
        if (!targetOrigin) { reject(new Error('Asset relay requires an extension origin.')); return; }
        const iframe = document.createElement('iframe');
        iframe.title = 'AI-MarkDone asset relay';
        iframe.setAttribute('aria-hidden', 'true');
        iframe.tabIndex = -1;
        iframe.style.cssText = 'position:fixed;left:-10000px;width:1px;height:1px;border:0;pointer-events:none;';
        const fail = () => { clearTimeout(timer); iframe.remove(); reject(new Error('Asset relay could not load.')); };
        const timer = setTimeout(fail, 5_000);
        iframe.addEventListener('error', fail, { once: true });
        iframe.addEventListener('load', () => {
            clearTimeout(timer);
            if (!iframe.contentWindow || !iframe.isConnected) { fail(); return; }
            const channel = new MessageChannel();
            try {
                iframe.contentWindow.postMessage({ v: RICH_ASSET_RELAY_VERSION, type: RICH_ASSET_RELAY_CONNECT }, targetOrigin, [channel.port2]);
                resolve({ port: channel.port1, extensionBaseUrl, teardown: () => iframe.remove() });
            } catch {
                channel.port1.close();
                channel.port2.close();
                fail();
            }
        }, { once: true });
        iframe.src = browser.runtime.getURL(extensionAssets.richAssetRelayPath);
        (document.body || document.documentElement).appendChild(iframe);
    });
}

const sharedRelay = new RichAssetRelayClient();

export function retainRichContentAssets(
    assets: readonly RichAssetRelayInput[],
    options?: { leaseId?: string; signal?: AbortSignal },
): Promise<RichAssetRelayLease> {
    return sharedRelay.retainAssets(assets, options);
}

export function releaseRichContentAssets(leaseId: string): Promise<void> {
    return sharedRelay.releaseLease(leaseId);
}
