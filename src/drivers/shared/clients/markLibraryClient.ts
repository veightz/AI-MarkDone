import { createRequestId, PROTOCOL_VERSION, type ExtRequest } from '../../../contracts/protocol';
import { isMarkCatalog, MARK_LIBRARY_KEY, type MarkCatalog, type MarkLibraryOperation } from '../../../contracts/markLibrary';
import { browser } from '../browser';
import { requestRuntimeClient, unwrapRuntimeClientResult } from './clientResult';
async function call(request: ExtRequest): Promise<MarkCatalog> {
    const data = unwrapRuntimeClientResult(await requestRuntimeClient(request)) as {
        catalog?: unknown;
    };
    if (!isMarkCatalog(data?.catalog))
        throw new Error('Invalid folder response');
    return data.catalog;
}
export const markLibraryClient = {
    get: () => call({ v: PROTOCOL_VERSION, id: createRequestId(), type: 'markLibrary:get' }),
    mutate: (operation: MarkLibraryOperation, expectedRevision: number) => call({ v: PROTOCOL_VERSION, id: createRequestId(), type: 'markLibrary:mutate', payload: { operation, expectedRevision } }),
    subscribe(listener: () => void): () => void {
        const events = browser?.storage?.onChanged;
        const changed = (changes: Record<string, unknown>, area: string) => { if (area === 'local' && MARK_LIBRARY_KEY in changes)
            listener(); };
        events?.addListener(changed);
        return () => events?.removeListener(changed);
    },
};
