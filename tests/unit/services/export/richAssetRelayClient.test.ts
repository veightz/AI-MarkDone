import { MessageChannel as NodeMessageChannel } from 'node:worker_threads';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RichAssetRelayClient } from '@/services/export/richAssetRelayClient';
import { RichAssetRelayHost } from '@/runtimes/rich-asset-relay/entry';
import type { RichAssetRelayCommand } from '@/services/export/richAssetRelayProtocol';
import { browser } from '@/drivers/shared/browser';

const disposals: Array<() => void> = [];
const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="10"><rect width="20" height="10" fill="red"/></svg>';
const input = { assetId: 'diagram.svg', blockId: 'diagram', mimeType: 'image/svg+xml' as const, blob: new Blob([svg], { type: 'image/svg+xml' }), widthPx: 20, heightPx: 10 };

function fixture(intercept?: (command: RichAssetRelayCommand) => boolean) {
    const channel = new NodeMessageChannel();
    const teardown = vi.fn(() => channel.port2.close());
    let next = 0;
    const revoke = vi.fn();
    const host = new RichAssetRelayHost({ createObjectURL: () => `blob:chrome-extension://extension-id/asset-${++next}`, revokeObjectURL: revoke });
    const commands: RichAssetRelayCommand[] = [];
    channel.port2.on('message', command => {
        commands.push(command);
        if (intercept?.(command)) return;
        const response = host.handle(command);
        if (response) channel.port2.postMessage(response);
    });
    const client = new RichAssetRelayClient(async () => ({ port: channel.port1 as unknown as MessagePort, extensionBaseUrl: 'chrome-extension://extension-id/', teardown }));
    disposals.push(() => { client.dispose(); host.dispose(); channel.port2.close(); });
    return { client, host, commands, teardown, revoke };
}

afterEach(() => { for (const dispose of disposals.splice(0)) dispose(); });

describe('rich asset relay client', () => {
    it('sends binary only through MessageChannel and retains the iframe until the last session lease closes', async () => {
        const { client, commands, teardown, revoke } = fixture();
        const first = await client.retainAssets([input], { leaseId: 'reader-1' });
        const second = await client.retainAssets([input], { leaseId: 'reader-2' });
        expect(first.refs[0]).toMatchObject({ assetId: input.assetId, blockId: input.blockId, objectUrl: 'blob:chrome-extension://extension-id/asset-1' });
        expect(JSON.parse(JSON.stringify(first.refs))).toEqual(first.refs);
        expect(commands.some(command => command.type === 'chunk' && Object.prototype.toString.call(command.bytes) === '[object ArrayBuffer]')).toBe(true);
        await first.release();
        expect(revoke).toHaveBeenCalledExactlyOnceWith('blob:chrome-extension://extension-id/asset-1');
        expect(teardown).not.toHaveBeenCalled();
        await second.release();
        expect(teardown).toHaveBeenCalledTimes(1);
        await second.release();
        expect(teardown).toHaveBeenCalledTimes(1);
    });

    it('releases partial uploads when a caller aborts a pending chunk', async () => {
        const { client, commands, teardown } = fixture(command => command.type === 'chunk');
        const controller = new AbortController();
        const retaining = client.retainAssets([input], { leaseId: 'cancelled-reader', signal: controller.signal });
        const rejection = expect(retaining).rejects.toMatchObject({ name: 'AbortError' });
        await vi.waitFor(() => expect(commands.some(command => command.type === 'chunk')).toBe(true));
        controller.abort();
        await rejection;
        expect(commands.at(-1)?.type).toBe('release');
        expect(teardown).toHaveBeenCalledTimes(1);
    });

    it('rejects malformed metadata and duplicate identities before creating a relay', async () => {
        const connect = vi.fn();
        const client = new RichAssetRelayClient(connect);
        await expect(client.retainAssets([{ ...input, blob: new Blob(['html'], { type: 'text/html' }) }])).rejects.toThrow('metadata');
        await expect(client.retainAssets([input, input])).rejects.toThrow('budget');
        expect(connect).not.toHaveBeenCalled();
        client.dispose();
    });

    it('keeps text-only Reader sessions free of relay frames and binary work', async () => {
        const connect = vi.fn();
        const client = new RichAssetRelayClient(connect);
        const lease = await client.retainAssets([]);
        expect(lease.refs).toEqual([]);
        expect(connect).not.toHaveBeenCalled();
        await lease.release();
        client.dispose();
    });

    it('locks the transferred port destination to the runtime extension origin rather than a redirected frame', async () => {
        vi.spyOn(browser.runtime, 'getURL').mockImplementation(path => `chrome-extension://extension-id/${path}`);
        vi.stubGlobal('MessageChannel', NodeMessageChannel);
        const client = new RichAssetRelayClient();
        disposals.push(() => { client.dispose(); vi.unstubAllGlobals(); });
        const retaining = client.retainAssets([input]);
        const rejected = expect(retaining).rejects.toThrow('could not load');
        const iframe = document.querySelector('iframe')!;
        const post = vi.spyOn(iframe.contentWindow!, 'postMessage').mockImplementation((_message, targetOrigin) => {
            expect(targetOrigin).toBe('chrome-extension://extension-id');
            throw new DOMException('Redirected destination has a different origin', 'SecurityError');
        });
        iframe.dispatchEvent(new Event('load'));
        await rejected;
        expect(post).toHaveBeenCalledTimes(1);
        expect(iframe.isConnected).toBe(false);
    });
});
