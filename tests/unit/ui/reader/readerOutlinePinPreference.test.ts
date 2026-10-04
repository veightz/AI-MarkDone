import { describe, expect, it, beforeEach } from 'vitest';
import {
    READER_OUTLINE_PIN_STORAGE_KEY,
    hydrateReaderOutlinePinned,
    peekReaderOutlinePinned,
    resetReaderOutlinePinMemoryForTests,
    writeReaderOutlinePinned,
} from '@/ui/content/reader/readerOutlinePinPreference';

type Store = Record<string, unknown>;

function memoryStorage(initial: Store = {}) {
    const stored: Store = { ...initial };
    return {
        stored,
        local: {
            get: async (key: string) => ({ [key]: stored[key] }),
            set: async (items: Store) => {
                Object.assign(stored, items);
            },
        },
    };
}

describe('readerOutlinePinPreference', () => {
    beforeEach(() => {
        resetReaderOutlinePinMemoryForTests();
    });

    it('defaults to dynamic when nothing is saved', async () => {
        const { local } = memoryStorage();
        expect(await hydrateReaderOutlinePinned(local)).toBe(false);
        expect(peekReaderOutlinePinned()).toBe(false);
    });

    it('persists pinned and dynamic choices', async () => {
        const { local, stored } = memoryStorage();
        await writeReaderOutlinePinned(true, local);
        expect(stored[READER_OUTLINE_PIN_STORAGE_KEY]).toBe(true);
        resetReaderOutlinePinMemoryForTests();
        expect(await hydrateReaderOutlinePinned(local)).toBe(true);

        await writeReaderOutlinePinned(false, local);
        resetReaderOutlinePinMemoryForTests();
        expect(await hydrateReaderOutlinePinned(local)).toBe(false);
        expect(peekReaderOutlinePinned()).toBe(false);
    });

    it('treats non-true stored values as dynamic', async () => {
        const { local } = memoryStorage({ [READER_OUTLINE_PIN_STORAGE_KEY]: 'pinned' });
        expect(await hydrateReaderOutlinePinned(local)).toBe(false);
    });

    it('does not let a stale read overwrite a newer toggle', async () => {
        let resolveGet: (value: Record<string, unknown>) => void = () => {};
        const local = {
            get: () => new Promise<Record<string, unknown>>((resolve) => {
                resolveGet = resolve;
            }),
            set: async () => undefined,
        };
        const pending = hydrateReaderOutlinePinned(local);
        await writeReaderOutlinePinned(true, local);
        resolveGet({ [READER_OUTLINE_PIN_STORAGE_KEY]: false });
        await expect(pending).resolves.toBe(true);
        expect(peekReaderOutlinePinned()).toBe(true);
    });
});
