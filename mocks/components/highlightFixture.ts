import { handleMarkLibraryRequest } from '../../src/runtimes/background/handlers/markLibrary';
import type { ExtRequest } from '../../src/contracts/protocol';
import { handleHighlightRequest } from '../../src/runtimes/background/handlers/highlights';
import { handleReaderAnnotationRequest } from '../../src/runtimes/background/handlers/annotations';

/** Disposable localhost fixture. The real handlers run against isolated localStorage. */
export function installHighlightFixture(): void {
    const api = (globalThis as any).browser;
    const prefix = 'AIMD_VISUAL_HIGHLIGHTS_DISPOSABLE:';
    const listeners = new Set<(changes: Record<string, unknown>, area: string) => void>();
    const emit = (key: string) => listeners.forEach(listener => listener({[key]: {}}, 'local'));
    api.storage = {onChanged: {addListener: (listener: any) => listeners.add(listener), removeListener: (listener: any) => listeners.delete(listener)}, local: {
        get: async (key: string | null) => {
            const result: Record<string, unknown> = {};
            const keys = key ? [key] : Object.keys(localStorage).filter(k=>k.startsWith(prefix)).map(k=>k.slice(prefix.length));
            for (const k of keys) { const value = localStorage.getItem(prefix+k); if (value !== null) result[k] = JSON.parse(value); }
            return result;
        },
        set: async (patch: Record<string,unknown>) => { for(const [key,value] of Object.entries(patch)){localStorage.setItem(prefix+key,JSON.stringify(value));emit(key);} },
        remove: async (key: string) => {localStorage.removeItem(prefix+key);emit(key);},
    }};
    window.addEventListener('storage', event => {if(event.key?.startsWith(prefix))emit(event.key.slice(prefix.length));});
    const previous = api.runtime.sendMessage;
    api.runtime.sendMessage = async (request: ExtRequest) => {
        if (request.type.startsWith('markLibrary:')) return (await handleMarkLibraryRequest(request))?.response;
        if (request.type.startsWith('highlights:')) return (await handleHighlightRequest(request))?.response;
        if (request.type.startsWith('annotations:')) return (await handleReaderAnnotationRequest(request))?.response;
        return previous(request);
    };
}
