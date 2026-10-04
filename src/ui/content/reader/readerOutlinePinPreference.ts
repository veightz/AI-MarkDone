import { browser } from '../../../drivers/shared/browser';

/** Extension local storage key. Absent or any non-true value means dynamic. */
export const READER_OUTLINE_PIN_STORAGE_KEY = 'aimdReaderOutlinePinned';

type OutlinePinStorage = {
    get: (key: string) => Promise<Record<string, unknown>>;
    set: (items: Record<string, unknown>) => Promise<void>;
};

let memory: boolean | null = null;
let revision = 0;

function defaultStorage(): OutlinePinStorage | null {
    const local = browser.storage?.local as OutlinePinStorage | undefined;
    if (!local || typeof local.get !== 'function' || typeof local.set !== 'function') return null;
    return local;
}

export function peekReaderOutlinePinned(): boolean {
    return memory === true;
}

export function resetReaderOutlinePinMemoryForTests(): void {
    memory = null;
    revision = 0;
}

/**
 * Last choice wins over an in-flight read. Missing storage => dynamic (false).
 */
export async function hydrateReaderOutlinePinned(local: OutlinePinStorage | null = defaultStorage()): Promise<boolean> {
    if (memory !== null) return memory;
    const seen = revision;
    let pinned = false;
    try {
        const result = local ? await local.get(READER_OUTLINE_PIN_STORAGE_KEY) : {};
        pinned = result?.[READER_OUTLINE_PIN_STORAGE_KEY] === true;
    } catch {
        pinned = false;
    }
    if (seen !== revision) return memory === true;
    memory = pinned;
    return pinned;
}

export async function writeReaderOutlinePinned(pinned: boolean, local: OutlinePinStorage | null = defaultStorage()): Promise<void> {
    revision += 1;
    memory = pinned;
    try {
        await local?.set({ [READER_OUTLINE_PIN_STORAGE_KEY]: pinned });
    } catch {
        // Keep the in-memory choice even if extension storage is unavailable.
    }
}
