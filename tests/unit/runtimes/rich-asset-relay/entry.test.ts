import { describe, expect, it, vi } from 'vitest';
import { RichAssetRelayHost, installRichAssetRelayHost } from '@/runtimes/rich-asset-relay/entry';
import { RICH_ASSET_RELAY_LIMITS, RICH_ASSET_RELAY_VERSION } from '@/services/export/richAssetRelayProtocol';

function fixture() {
    const urls = { createObjectURL: vi.fn(() => 'blob:chrome-extension://extension/id-1'), revokeObjectURL: vi.fn() };
    const host = new RichAssetRelayHost(urls);
    let request = 0;
    const send = (payload: object) => host.handle({ v: RICH_ASSET_RELAY_VERSION, requestId: `r-${++request}`, leaseId: 'lease-1', ...payload });
    return { urls, host, send };
}

const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="10"><rect width="20" height="10" fill="red"/></svg>';

describe('rich asset relay host', () => {
    it('requires the actual parent Window and an allowed origin before accepting a transferred port', () => {
        const listeners = new Map<string, (event: unknown) => void>();
        const parent = {};
        const target = { parent, location: { href: 'chrome-extension://extension-id/rich-asset-relay.html' },
            addEventListener: (type: string, listener: (event: unknown) => void) => listeners.set(type, listener),
            removeEventListener: (type: string) => listeners.delete(type),
        };
        const dispose = installRichAssetRelayHost(target as unknown as Window);
        const port = { addEventListener: vi.fn(), start: vi.fn(), close: vi.fn() };
        const event = { data: { v: 1, type: 'aimd:rich-asset-relay:connect' }, source: parent, origin: 'https://evil.example', ports: [port] };
        listeners.get('message')!(event);
        listeners.get('message')!({ ...event, origin: 'https://chatgpt.com', source: {} });
        expect(port.start).not.toHaveBeenCalled();
        listeners.get('message')!({ ...event, origin: 'https://chatgpt.com' });
        expect(port.start).toHaveBeenCalledTimes(1);
        dispose();
        expect(port.close).toHaveBeenCalledTimes(1);
    });
    it('commits bounded chunks into a local Blob and revokes it only on lease release', () => {
        const { urls, send } = fixture();
        const bytes = new TextEncoder().encode(svg);
        const metadata = { assetId: 'diagram.svg', blockId: 'diagram', mimeType: 'image/svg+xml', byteLength: bytes.length, widthPx: 20, heightPx: 10 };
        expect(send({ type: 'begin', asset: metadata })?.ok).toBe(true);
        expect(send({ type: 'commit', assetId: metadata.assetId })?.ok).toBe(false);
        expect(send({ type: 'chunk', assetId: metadata.assetId, sequence: 1, bytes: bytes.buffer })?.ok).toBe(false);
        expect(send({ type: 'chunk', assetId: metadata.assetId, sequence: 0, bytes: bytes.slice(0, 30).buffer })?.ok).toBe(true);
        expect(send({ type: 'chunk', assetId: metadata.assetId, sequence: 1, bytes: bytes.slice(30).buffer })?.ok).toBe(true);
        expect(send({ type: 'commit', assetId: metadata.assetId })).toMatchObject({ ok: true, asset: { ...metadata, objectUrl: 'blob:chrome-extension://extension/id-1' } });
        expect(urls.revokeObjectURL).not.toHaveBeenCalled();
        expect(send({ type: 'release' })?.ok).toBe(true);
        expect(urls.revokeObjectURL).toHaveBeenCalledExactlyOnceWith('blob:chrome-extension://extension/id-1');
        send({ type: 'release' });
        expect(urls.revokeObjectURL).toHaveBeenCalledTimes(1);
    });

    it('rejects unsafe SVG bytes independently of content-side sanitization', () => {
        const { urls, send } = fixture();
        const bytes = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"/>');
        send({ type: 'begin', asset: { assetId: 'unsafe.svg', blockId: 'unsafe', mimeType: 'image/svg+xml', byteLength: bytes.length, widthPx: 20, heightPx: 10 } });
        send({ type: 'chunk', assetId: 'unsafe.svg', sequence: 0, bytes: bytes.buffer });
        expect(send({ type: 'commit', assetId: 'unsafe.svg' })).toMatchObject({ ok: false, error: 'INVALID_REQUEST' });
        expect(urls.createObjectURL).not.toHaveBeenCalled();
    });

    it('reserves declared bytes before accepting chunks and releases abandoned staging', () => {
        const { send } = fixture();
        const metadata = { blockId: 'large', mimeType: 'image/png', byteLength: RICH_ASSET_RELAY_LIMITS.maxAssetBytes, widthPx: 20, heightPx: 10 };
        for (let i = 0; i < 3; i++) expect(send({ type: 'begin', asset: { ...metadata, assetId: `large-${i}` } })?.ok).toBe(true);
        expect(send({ type: 'begin', asset: { ...metadata, assetId: 'overflow' } })).toMatchObject({ ok: false, error: 'LIMIT_EXCEEDED' });
        send({ type: 'release' });
        expect(send({ type: 'begin', asset: { ...metadata, assetId: 'after-release' } })?.ok).toBe(true);
    });

    it('rejects PNG dimensions that differ from the byte header', () => {
        const { urls, send } = fixture();
        const bytes = new Uint8Array(33);
        bytes.set([137, 80, 78, 71, 13, 10, 26, 10], 0);
        bytes.set([73, 72, 68, 82], 12);
        const view = new DataView(bytes.buffer);
        view.setUint32(16, 30);
        view.setUint32(20, 10);
        send({ type: 'begin', asset: { assetId: 'mismatch.png', blockId: 'image', mimeType: 'image/png', byteLength: bytes.length, widthPx: 20, heightPx: 10 } });
        send({ type: 'chunk', assetId: 'mismatch.png', sequence: 0, bytes: bytes.buffer });
        expect(send({ type: 'commit', assetId: 'mismatch.png' })?.ok).toBe(false);
        expect(urls.createObjectURL).not.toHaveBeenCalled();
    });
});
