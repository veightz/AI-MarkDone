import { describe, expect, it } from 'vitest';
import {
    RICH_ASSET_RELAY_VERSION,
    RICH_ASSET_RELAY_LIMITS,
    isRichAssetRelayCommand,
    isRichAssetRelayRef,
    richAssetRelayOrigin,
    isAllowedRichAssetRelayParent,
} from '@/services/export/richAssetRelayProtocol';
import { cloneRichAssetRelayRef } from '@/contracts/richContentAssets';

const metadata = {
    assetId: 'block-1.svg', blockId: 'block-1', mimeType: 'image/svg+xml',
    byteLength: 256, widthPx: 100, heightPx: 80,
};

describe('rich asset relay protocol', () => {
    it('uses exact extension origins and admits only ChatGPT or the same extension as a relay parent', () => {
        const base = 'chrome-extension://extension-id/';
        expect(richAssetRelayOrigin(base)).toBe('chrome-extension://extension-id');
        expect(richAssetRelayOrigin('moz-extension://extension-uuid/rich-asset-relay.html')).toBe('moz-extension://extension-uuid');
        expect(richAssetRelayOrigin('https://evil.example/relay')).toBeNull();
        expect(richAssetRelayOrigin('safari-web-extension://retired/relay')).toBeNull();
        expect(isAllowedRichAssetRelayParent('https://chatgpt.com', base)).toBe(true);
        expect(isAllowedRichAssetRelayParent('https://chat.openai.com', base)).toBe(true);
        expect(isAllowedRichAssetRelayParent('chrome-extension://extension-id', base)).toBe(true);
        expect(isAllowedRichAssetRelayParent('chrome-extension://another-id', base)).toBe(false);
        expect(isAllowedRichAssetRelayParent('https://chatgpt.com.evil.example', base)).toBe(false);
        expect(isAllowedRichAssetRelayParent('null', base)).toBe(false);
    });
    it('accepts only versioned, bounded binary chunks and image metadata', () => {
        const command = { v: RICH_ASSET_RELAY_VERSION, requestId: 'request-1', leaseId: 'lease-1', type: 'begin', asset: metadata };
        expect(isRichAssetRelayCommand(command)).toBe(true);
        expect(isRichAssetRelayCommand({ ...command, v: 2 })).toBe(false);
        expect(isRichAssetRelayCommand({ ...command, asset: { ...metadata, mimeType: 'text/html' } })).toBe(false);
        expect(isRichAssetRelayCommand({ ...command, asset: { ...metadata, byteLength: RICH_ASSET_RELAY_LIMITS.maxAssetBytes + 1 } })).toBe(false);
        expect(isRichAssetRelayCommand({ ...command, asset: { ...metadata, widthPx: Number.NaN } })).toBe(false);
        expect(isRichAssetRelayCommand({ ...command, type: 'chunk', assetId: metadata.assetId, sequence: 0, bytes: new ArrayBuffer(12) })).toBe(true);
        expect(isRichAssetRelayCommand({ ...command, type: 'chunk', assetId: metadata.assetId, sequence: -1, bytes: new ArrayBuffer(12) })).toBe(false);
        expect(isRichAssetRelayCommand({ ...command, type: 'chunk', assetId: metadata.assetId, sequence: 0, bytes: [1, 2] })).toBe(false);
        expect(isRichAssetRelayCommand({ ...command, type: 'chunk', assetId: metadata.assetId, sequence: 0, bytes: new ArrayBuffer(RICH_ASSET_RELAY_LIMITS.chunkBytes + 1) })).toBe(false);
    });

    it('accepts JSON references only for the exact extension-owned Blob origin', () => {
        const base = 'chrome-extension://extension-id/';
        const ref = { ...metadata, objectUrl: `blob:${base}id-1` };
        expect(isRichAssetRelayRef(ref, base)).toBe(true);
        expect(isRichAssetRelayRef({ ...ref, objectUrl: 'blob:https://chatgpt.com/id-1' }, base)).toBe(false);
        expect(isRichAssetRelayRef({ ...ref, objectUrl: 'blob:chrome-extension://extension-id.evil/id-1' }, base)).toBe(false);
        expect(isRichAssetRelayRef({ ...ref, objectUrl: 'https://example.com/image.png' }, base)).toBe(false);
        expect(isRichAssetRelayRef({ ...ref, objectUrl: `blob:${base}id-1?extra=1` }, base)).toBe(false);
        expect(isRichAssetRelayRef({ ...ref, objectUrl: 'blob:moz-extension://extension-id/id-1' }, 'moz-extension://extension-id/')).toBe(true);
        expect(isRichAssetRelayRef({ ...ref, objectUrl: 'blob:safari-web-extension://retired/id-1' }, 'safari-web-extension://retired/')).toBe(false);
    });

    it('projects session metadata through a whitelist so additive source fields cannot carry binary payloads', () => {
        const ref = {
            ...metadata, mimeType: 'image/svg+xml' as const, objectUrl: 'blob:chrome-extension://extension-id/id-1',
            blob: new Blob(['extra']), bytes: new ArrayBuffer(8), extra: 'ignored',
        };
        const clean = cloneRichAssetRelayRef(ref);
        expect(Object.keys(clean)).toEqual(['assetId', 'blockId', 'mimeType', 'byteLength', 'widthPx', 'heightPx', 'objectUrl']);
        expect(JSON.parse(JSON.stringify(clean))).toEqual(clean);
        expect(Object.isFrozen(clean)).toBe(true);
    });
});
