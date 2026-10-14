import { describe, expect, it, vi } from 'vitest';
import { richSvgBlock } from '../../../helpers/richContentFixtures';

const request = vi.hoisted(() => vi.fn());
vi.mock('@/drivers/shared/clients/clientResult', () => ({ requestRuntimeClient: request }));
vi.mock('@/drivers/shared/browser', () => ({ browser: { runtime: { getURL: () => 'chrome-extension://mock/' } } }));
import { createDetachedReaderRichContentResolver } from '@/runtimes/reader/readerRichContentClient';

describe('Detached Reader rich asset client', () => {
    it('releases again after a late successful response when its early cancellation already sent release', async () => {
        let complete!: (value: unknown) => void;
        request.mockImplementation(message => message.type === 'readerSession:assets'
            ? new Promise(resolve => { complete = resolve; }) : Promise.resolve({ ok: true, data: {} }));
        const controller = new AbortController();
        const promise = createDetachedReaderRichContentResolver('session-1')({ id: 'item', userPrompt: '', content: '', richBlocks: [richSvgBlock()] }, controller.signal);
        const leaseId = request.mock.calls[0]![0].payload.leaseId;
        controller.abort();
        complete({ ok: true, data: { version: 1, leaseId, refs: [{ assetId: 'asset', blockId: 'block-1', mimeType: 'image/png', byteLength: 5, widthPx: 10, heightPx: 10, objectUrl: 'blob:chrome-extension://mock/asset' }] } });
        await expect(promise).rejects.toMatchObject({ name: 'AbortError' });
        expect(request.mock.calls.filter(([message]) => message.type === 'readerSession:releaseAssets')).toHaveLength(2);
    });
});
