import { describe, expect, it, vi } from 'vitest';
import { ReaderRichAssetSessions } from '@/services/reader/readerRichAssetSession';
import { readReaderSessionAssetResult } from '@/services/reader/readerRichAssetProtocol';
import { richSvgBlock } from '../../../helpers/richContentFixtures';

function fixture() {
    const blob = new Blob(['svg'], { type: 'image/svg+xml' });
    const asset = { assetId: 'asset-svg', blockId: 'block-1', visualDigest: 'visual-1', mimeType: 'image/svg+xml' as const, blob, objectUrl: `blob:${location.origin}/source`, widthPx: 10, heightPx: 10, filename: 'diagram.svg' };
    const releasePrepared = vi.fn();
    const releaseRelay = vi.fn(async () => undefined);
    const prepare = vi.fn(async () => ({ assets: [asset], failures: [], release: releasePrepared }));
    const retain = vi.fn(async (_assets, options) => ({ leaseId: options.leaseId, refs: [{ ...asset, byteLength: blob.size, objectUrl: 'blob:chrome-extension://mock/asset' }], release: releaseRelay }));
    return { prepare, retain, releasePrepared, releaseRelay, asset };
}

describe('Reader rich asset sessions', () => {
    it('pins extension refs to one session and releases original capture ownership after transport', async () => {
        const mocks = fixture();
        const sessions = new ReaderRichAssetSessions(mocks);
        const result = await sessions.prepare('session-1', { id: 'item', userPrompt: '', content: '![Diagram](aimd-rich:block-1)', richBlocks: [richSvgBlock()] }, 'https://chatgpt.com/c/1', 'lease-1');
        expect(result.refs[0]?.objectUrl).toBe('blob:chrome-extension://mock/asset');
        expect(mocks.releasePrepared).toHaveBeenCalledTimes(1);
        await sessions.release('other-session', 'lease-1');
        expect(mocks.releaseRelay).not.toHaveBeenCalled();
        await sessions.release('session-1', 'lease-1');
        expect(mocks.releaseRelay).toHaveBeenCalledTimes(1);
    });

    it('does not retain a late capture after its session was closed', async () => {
        const mocks = fixture();
        let complete!: (value: unknown) => void;
        mocks.prepare.mockImplementationOnce(() => new Promise(resolve => { complete = resolve; }));
        const sessions = new ReaderRichAssetSessions(mocks);
        const promise = sessions.prepare('session-1', { id: 'item', userPrompt: '', content: '', richBlocks: [richSvgBlock()] }, 'https://chatgpt.com/c/1', 'lease-1');
        await sessions.release('session-1');
        complete({ assets: [mocks.asset], failures: [], release: mocks.releasePrepared });
        await expect(promise).rejects.toMatchObject({ name: 'AbortError' });
        expect(mocks.retain).not.toHaveBeenCalled();
        expect(mocks.releasePrepared).toHaveBeenCalledTimes(1);
    });

    it('rejects duplicate, remote, foreign and excessive capabilities', () => {
        const ref = { assetId: 'asset', blockId: 'block-1', mimeType: 'image/png', byteLength: 10, widthPx: 10, heightPx: 10, objectUrl: 'blob:chrome-extension://mock/asset' };
        const response = { version: 1, leaseId: 'lease-1', refs: [ref] };
        const read = (value: unknown) => readReaderSessionAssetResult(value, [richSvgBlock()], 'chrome-extension://mock/', 'lease-1');
        expect(read(response)).toBeTruthy();
        expect(read({ ...response, refs: [ref, ref] })).toBeNull();
        expect(read({ ...response, refs: [{ ...ref, objectUrl: 'https://example.com/asset.png' }] })).toBeNull();
        expect(read({ ...response, refs: [{ ...ref, blockId: 'foreign' }] })).toBeNull();
        expect(read({ ...response, refs: [{ ...ref, byteLength: 9 * 1024 * 1024 }] })).toBeNull();
    });
});
