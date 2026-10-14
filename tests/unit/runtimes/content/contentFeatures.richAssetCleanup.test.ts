import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/ui/content/reader/ReaderPanel', () => ({ ReaderPanel: class {} }));
vi.mock('@/ui/content/export/SaveMessagesDialog', () => ({ saveMessagesDialog: {} }));
vi.mock('@/services/copy/copy-turn-png', () => ({ copyMessagePng: vi.fn(async () => ({ ok: true, noop: true })) }));

const OriginalURL = URL;
let disposeDriver: (() => void) | undefined;
let revoke: ReturnType<typeof vi.fn>;

beforeEach(() => {
    vi.resetModules();
    let sequence = 0;
    revoke = vi.fn();
    vi.stubGlobal('URL', class extends OriginalURL {
        static createObjectURL = vi.fn(() => `blob:https://chatgpt.com/image-${++sequence}`);
        static revokeObjectURL = revoke;
    });
    vi.stubGlobal('Image', class {
        onload: (() => void) | null = null;
        onerror: (() => void) | null = null;
        set src(value: string) { if (value) queueMicrotask(() => this.onerror?.()); }
        removeAttribute() {}
    });
});

afterEach(() => {
    disposeDriver?.();
    disposeDriver = undefined;
    vi.doUnmock('@/drivers/content/export/richContentAssets');
    vi.unstubAllGlobals();
});

const block = {
    id: 'diagram', kind: 'svg' as const, label: 'Diagram', fallbackMarkdown: '> [Diagram]', visualDigest: 'digest',
    source: { kind: 'svg' as const, svg: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="10"><rect width="20" height="10"/></svg>' },
};

describe('content feature asset cleanup without detached Reader', () => {
    it('does not load capture capabilities merely to tear down an unused feature', async () => {
        const loadCapture = vi.fn(() => { throw new Error('Capture module must remain unloaded'); });
        vi.doMock('@/drivers/content/export/richContentAssets', loadCapture);
        const features = await import('@/runtimes/content/contentFeatures');
        features.disposeRichContentResources();
        expect(loadCapture).not.toHaveBeenCalled();
    });

    it.each(['reader', 'export', 'copy-png'] as const)('cleans assets loaded by the %s entry without creating a detached asset manager', async entry => {
        const features = await import('@/runtimes/content/contentFeatures');
        if (entry === 'reader') await features.createReaderPanel();
        else if (entry === 'export') await features.getSaveMessagesDialog();
        else await features.copyMessagePng({ user: '', assistant: '', index: 0 }, {
            url: 'https://chatgpt.com/c/example', exportedAt: '', title: '', count: 1, platform: 'ChatGPT',
        }, { t: key => key });
        const assets = await import('@/drivers/content/export/richContentAssets');
        disposeDriver = assets.disposeRichContentAssets;
        const lease = await assets.prepareRichContentAssets([block]);
        expect(lease.assets).toHaveLength(1);
        revoke.mockClear();
        features.disposeRichContentResources();
        expect(revoke).toHaveBeenCalledWith(lease.assets[0].objectUrl);
        lease.release();
    });

    it('cancels an export-only capture still waiting for image decode during runtime teardown', async () => {
        const features = await import('@/runtimes/content/contentFeatures');
        await features.getSaveMessagesDialog();
        let imageStarted = false;
        vi.stubGlobal('Image', class {
            onload: (() => void) | null = null;
            onerror: (() => void) | null = null;
            set src(value: string) { if (value) imageStarted = true; }
            removeAttribute() {}
        });
        const assets = await import('@/drivers/content/export/richContentAssets');
        disposeDriver = assets.disposeRichContentAssets;
        const preparing = assets.prepareRichContentAssets([block]);
        const rejected = expect(preparing).rejects.toMatchObject({ name: 'AbortError' });
        await vi.waitFor(() => expect(imageStarted).toBe(true));
        features.disposeRichContentResources();
        await rejected;
        expect(revoke).toHaveBeenCalledWith('blob:https://chatgpt.com/image-1');
    });
});
