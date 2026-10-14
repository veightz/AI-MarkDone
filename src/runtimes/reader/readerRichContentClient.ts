import { PROTOCOL_VERSION, createRequestId } from '../../contracts/protocol';
import { browser } from '../../drivers/shared/browser';
import { requestRuntimeClient } from '../../drivers/shared/clients/clientResult';
import { readReaderSessionAssetResult } from '../../services/reader/readerRichAssetProtocol';
import type { ReaderRichContentResolver } from '../../services/reader/types';

export function createDetachedReaderRichContentResolver(sessionId: string): ReaderRichContentResolver {
    return async (item, signal) => {
        if (signal.aborted) throw new DOMException('Reader assets cancelled', 'AbortError');
        const leaseId = `reader-rich-${crypto.randomUUID()}`;
        let released = false;
        const sendRelease = () => requestRuntimeClient({ v: PROTOCOL_VERSION, id: createRequestId(), type: 'readerSession:releaseAssets', payload: { version: 1, sessionId, leaseId } }, { timeoutMs: 3000 }).catch(() => undefined);
        const release = async () => {
            if (released) return;
            released = true;
            signal.removeEventListener('abort', onAbort);
            await sendRelease();
        };
        const onAbort = () => { void release(); };
        signal.addEventListener('abort', onAbort, { once: true });
        try {
            const response = await requestRuntimeClient<unknown>({
                v: PROTOCOL_VERSION, id: createRequestId(), type: 'readerSession:assets',
                payload: { version: 1, sessionId, itemId: item.id, leaseId,
                    blockVersions: (item.richBlocks ?? []).map(block => ({ blockId: block.id, visualDigest: block.visualDigest })) },
            }, { timeoutMs: 12_000 });
            // Cancellation may reach the source before preparation starts.
            // Once a late response arrives, release the now-known job again.
            if (signal.aborted) { await sendRelease(); throw new DOMException('Reader assets cancelled', 'AbortError'); }
            if (!response.ok) throw new Error(response.message);
            const result = readReaderSessionAssetResult(response.data, item.richBlocks ?? [], browser.runtime.getURL(''), leaseId);
            if (!result) throw new Error('Invalid Reader asset capabilities');
            return {
                assets: result.refs.map(ref => ({ blockId: ref.blockId, url: ref.objectUrl, mimeType: ref.mimeType })), release,
            };
        } catch (error) { await release(); throw error; }
    };
}
