import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { toCanvas } from 'html-to-image';
import { collectChatGPTRichBlockSurfaces } from '@/drivers/content/chatgpt/chatgptRichContent';
import { __resetRichContentAssetsForTests, prepareRichContentAssets } from '@/drivers/content/export/richContentAssets';
import type { RichBlockV1 } from '@/contracts/richContent';

vi.mock('html-to-image', () => ({ toCanvas: vi.fn() }));

const OriginalURL = URL;
const svgBlock: RichBlockV1 = {
    id: 'diagram', kind: 'svg', label: 'Diagram', fallbackMarkdown: '> [Diagram]', visualDigest: 'digest1',
    source: { kind: 'svg', svg: '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="80"><rect width="100" height="80" fill="red"/></svg>' },
};
let createUrl: ReturnType<typeof vi.fn>;
let revokeUrl: ReturnType<typeof vi.fn>;
let drawImage: ReturnType<typeof vi.fn>;

function mountedRoot(html: string): HTMLElement {
    const root = document.createElement('div');
    root.innerHTML = html;
    document.body.append(root);
    return root;
}

describe('rich content asset preparation', () => {
    beforeEach(() => {
        let index = 0;
        createUrl = vi.fn(() => `blob:https://chatgpt.com/asset-${++index}`);
        revokeUrl = vi.fn();
        vi.stubGlobal('URL', class extends OriginalURL {
            static createObjectURL = createUrl;
            static revokeObjectURL = revokeUrl;
        });
        vi.stubGlobal('Image', class {
            onload: (() => void) | null = null;
            onerror: (() => void) | null = null;
            set src(value: string) { if (value) queueMicrotask(() => this.onload?.()); }
            removeAttribute() {}
        });
        drawImage = vi.fn();
        vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ drawImage } as unknown as CanvasRenderingContext2D);
        vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(callback => callback(new Blob(['png-bytes'], { type: 'image/png' })));
        vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue('data:image/png;base64,cG5n');
        vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('Unexpected fetch'))));
    });
    afterEach(() => {
        __resetRichContentAssetsForTests();
        document.body.replaceChildren();
        vi.unstubAllGlobals();
    });

    it('prepares native SVG plus a PNG compatibility image without fetching resources', async () => {
        const lease = await prepareRichContentAssets([svgBlock], { resolveMessageRoot: () => null });
        expect(lease.failures).toEqual([]);
        expect(lease.assets.map(asset => asset.mimeType)).toEqual(['image/svg+xml', 'image/png']);
        expect(lease.assets.every(asset => asset.blockId === 'diagram' && asset.widthPx === 100 && asset.heightPx === 80)).toBe(true);
        expect(fetch).not.toHaveBeenCalled();
        lease.release();
    });

    it('uses a whole-lease deadline without starting remaining captures', async () => {
        const lease = await prepareRichContentAssets([svgBlock, { ...svgBlock, id: 'second-diagram' }], { deadlineMs: Date.now() - 1 });
        expect(lease.assets).toEqual([]);
        expect(lease.failures).toEqual([{ blockId: 'diagram', reason: 'timeout' }, { blockId: 'second-diagram', reason: 'timeout' }]);
        expect(createUrl).not.toHaveBeenCalled();
    });

    it('reuses immutable cached bytes across independent leases without revoking a live lease', async () => {
        const first = await prepareRichContentAssets([svgBlock], { messageId: 'message-1' });
        const draws = drawImage.mock.calls.length;
        const second = await prepareRichContentAssets([svgBlock], { messageId: 'message-1' });
        expect(second.assets).toEqual(first.assets);
        expect(drawImage).toHaveBeenCalledTimes(draws);
        revokeUrl.mockClear();
        first.release();
        first.release();
        expect(revokeUrl).not.toHaveBeenCalled();
        vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 120_001);
        await prepareRichContentAssets([]);
        expect(revokeUrl).not.toHaveBeenCalled();
        second.release();
        expect(revokeUrl).toHaveBeenCalledTimes(2);
    });

    it('does not reuse a sealed SVG when its source changes under the same block identity and visual digest', async () => {
        const first = await prepareRichContentAssets([svgBlock]);
        const updated: RichBlockV1 = { ...svgBlock, source: { kind: 'svg', svg: svgBlock.source.kind === 'svg' ? svgBlock.source.svg.replace('red', 'blue') : '' } };
        const second = await prepareRichContentAssets([updated]);
        expect(second.assets[0].blob).not.toBe(first.assets[0].blob);
        expect(second.assets[0].objectUrl).not.toBe(first.assets[0].objectUrl);
        expect(drawImage).toHaveBeenCalledTimes(2);
        first.release();
        second.release();
    });

    it.each(['canvas', 'image', 'html'] as const)('captures fresh %s pixels for a later explicit action even when DOM identity stays unchanged', async kind => {
        const markup = kind === 'canvas' ? '<canvas width="100" height="80"></canvas>'
            : kind === 'image' ? '<img src="https://example.com/animated.webp" alt="Animation">'
            : '<div data-testid="chatgpt-chart-content-reference">Animated chart</div>';
        const root = mountedRoot(markup);
        const source = root.firstElementChild!;
        if (source instanceof HTMLImageElement) Object.defineProperties(source, { complete: { value: true }, naturalWidth: { value: 100 }, naturalHeight: { value: 80 } });
        vi.spyOn(source, 'getBoundingClientRect').mockReturnValue({ width: 100, height: 80 } as DOMRect);
        vi.mocked(toCanvas).mockImplementation(async () => {
            const canvas = document.createElement('canvas');
            canvas.width = 100;
            canvas.height = 80;
            return canvas;
        });
        let pixels = 'old frame';
        vi.mocked(HTMLCanvasElement.prototype.toBlob).mockImplementation(callback => callback(new Blob([pixels], { type: 'image/png' })));
        const block = collectChatGPTRichBlockSurfaces(root)[0].block;
        const first = await prepareRichContentAssets([block], { resolveMessageRoot: () => root });
        const unchanged = collectChatGPTRichBlockSurfaces(root)[0].block;
        expect(unchanged.id).toBe(block.id);
        expect(unchanged.visualDigest).toBe(block.visualDigest);
        pixels = 'a different animation frame';
        const second = await prepareRichContentAssets([unchanged], { resolveMessageRoot: () => root });
        expect(second.assets[0].blob.size).toBe(pixels.length);
        expect(second.assets[0].objectUrl).not.toBe(first.assets[0].objectUrl);
        revokeUrl.mockClear();
        first.release();
        expect(revokeUrl).toHaveBeenCalledWith(first.assets[0].objectUrl);
        expect(revokeUrl).not.toHaveBeenCalledWith(second.assets[0].objectUrl);
        second.release();
        expect(revokeUrl).toHaveBeenCalledWith(second.assets[0].objectUrl);
    });

    it('reclaims released pixel-action entries immediately instead of accumulating nonce entries', async () => {
        const root = mountedRoot('<canvas width="100" height="80"></canvas>');
        const block = collectChatGPTRichBlockSurfaces(root)[0].block;
        for (let index = 0; index < 130; index++) {
            const lease = await prepareRichContentAssets([block], { resolveMessageRoot: () => root });
            expect(lease.failures).toEqual([]);
            expect(lease.assets).toHaveLength(1);
            lease.release();
        }
        expect(createUrl).toHaveBeenCalledTimes(130);
        expect(revokeUrl).toHaveBeenCalledTimes(130);
    });

    it('keeps simultaneous pixel-action leases inside the global byte budget and makes released capacity reusable', async () => {
        const root = mountedRoot('<canvas width="100" height="80"></canvas>');
        const block = collectChatGPTRichBlockSurfaces(root)[0].block;
        vi.mocked(HTMLCanvasElement.prototype.toBlob).mockImplementation(callback => {
            const blob = new Blob(['fixture'], { type: 'image/png' });
            Object.defineProperty(blob, 'size', { value: 7 * 1024 * 1024 });
            callback(blob);
        });
        const leases = [];
        for (let index = 0; index < 6; index++) {
            const lease = await prepareRichContentAssets([block], { resolveMessageRoot: () => root });
            expect(lease.assets).toHaveLength(1);
            leases.push(lease);
        }
        const overflow = await prepareRichContentAssets([block], { resolveMessageRoot: () => root });
        expect(overflow.assets).toEqual([]);
        expect(overflow.failures).toEqual([{ blockId: block.id, reason: 'limit-exceeded' }]);
        leases.shift()!.release();
        const reused = await prepareRichContentAssets([block], { resolveMessageRoot: () => root });
        expect(reused.assets).toHaveLength(1);
        for (const lease of leases) lease.release();
        reused.release();
    });

    it('refuses changed or unmounted live surfaces instead of using a global DOM fallback', async () => {
        const root = mountedRoot('<canvas width="100" height="80"></canvas>');
        const block = collectChatGPTRichBlockSurfaces(root)[0].block;
        root.querySelector('canvas')!.setAttribute('width', '101');
        const changed = await prepareRichContentAssets([block], { resolveMessageRoot: () => root });
        expect(changed.failures).toEqual([{ blockId: block.id, reason: 'source-changed' }]);
        const absent = await prepareRichContentAssets([block]);
        expect(absent.failures).toEqual([{ blockId: block.id, reason: 'not-rendered' }]);
        expect(drawImage).not.toHaveBeenCalled();
    });

    it('captures only already loaded image pixels and turns a tainted canvas into an explicit failure', async () => {
        const root = mountedRoot('<img src="https://untrusted.example/image.png" alt="Photo">');
        const image = root.querySelector('img')!;
        Object.defineProperties(image, { complete: { value: true }, naturalWidth: { value: 100 }, naturalHeight: { value: 80 } });
        const block = collectChatGPTRichBlockSurfaces(root)[0].block;
        vi.mocked(HTMLCanvasElement.prototype.toBlob).mockImplementation(() => { throw new DOMException('Tainted', 'SecurityError'); });
        const lease = await prepareRichContentAssets([block], { resolveMessageRoot: () => root });
        expect(lease.failures).toEqual([{ blockId: block.id, reason: 'cross-origin' }]);
        expect(fetch).not.toHaveBeenCalled();
        expect(image.getAttribute('src')).toBe('https://untrusted.example/image.png');
    });

    it('fits already loaded large image pixels inside the canvas budget without requesting a different URL', async () => {
        const root = mountedRoot('<img src="https://example.com/loaded-photo.png" alt="Photo">');
        const image = root.querySelector('img')!;
        Object.defineProperties(image, { complete: { value: true }, naturalWidth: { value: 4_000 }, naturalHeight: { value: 3_000 } });
        const block = collectChatGPTRichBlockSurfaces(root)[0].block;
        const lease = await prepareRichContentAssets([block], { resolveMessageRoot: () => root });
        expect(lease.failures).toEqual([]);
        expect(lease.assets[0].widthPx * lease.assets[0].heightPx).toBeLessThanOrEqual(8_000_000);
        expect(lease.assets[0].widthPx / lease.assets[0].heightPx).toBeCloseTo(4 / 3, 2);
        expect(fetch).not.toHaveBeenCalled();
        lease.release();
    });

    it('reconstructs inert HTML and foreignObject labels with zero remote URLs before rasterization', async () => {
        const root = mountedRoot('<div data-testid="chatgpt-chart-content-reference" onclick="alert(1)" style="background-image:url(https://untrusted.example/background.png)"><script>fetch("https://untrusted.example")</script><svg width="100" height="80"><foreignObject width="100" height="80"><div xmlns="http://www.w3.org/1999/xhtml">Chart label<img src="https://untrusted.example/image.png" alt="Photo"></div></foreignObject></svg></div>');
        const source = root.firstElementChild!;
        vi.spyOn(source, 'getBoundingClientRect').mockReturnValue({ width: 100, height: 80 } as DOMRect);
        const block = collectChatGPTRichBlockSurfaces(root)[0].block;
        vi.mocked(toCanvas).mockImplementation(async () => {
            const canvas = document.createElement('canvas');
            canvas.width = 100;
            canvas.height = 80;
            return canvas;
        });
        const lease = await prepareRichContentAssets([block], { resolveMessageRoot: () => root });
        expect(toCanvas).toHaveBeenCalled();
        const [node, options] = vi.mocked(toCanvas).mock.calls[0];
        expect(options).toMatchObject({ skipFonts: true, fontEmbedCSS: '', includeStyleProperties: [] });
        expect(node.querySelector('script, [onclick], link, iframe')).toBeNull();
        expect(node.outerHTML).not.toContain('untrusted.example');
        expect(node.outerHTML).toContain('foreignObject');
        expect(node.textContent).toContain('Chart label');
        expect(lease.failures).toEqual([]);
        expect(lease.assets).toHaveLength(1);
        expect(lease.assets[0].mimeType).toBe('image/png');
        expect(fetch).not.toHaveBeenCalled();
        expect(document.querySelector('[data-aimd-rich-capture]')).toBeNull();
        expect(source.hasAttribute('onclick')).toBe(true);
        lease.release();
    });

    it('rejects SVG symbol references outside the controlled clone before html-to-image can supplement them from document', async () => {
        document.body.innerHTML = '<svg><defs><g id="outside-definition"><image href="https://untrusted.example/secret.png"/></g></defs></svg>';
        const root = mountedRoot('<div data-testid="chatgpt-chart-content-reference"><svg width="100" height="80" xmlns:xlink="http://www.w3.org/1999/xlink"><use xlink:href="#outside-definition"/></svg></div>');
        vi.spyOn(root.firstElementChild!, 'getBoundingClientRect').mockReturnValue({ width: 100, height: 80 } as DOMRect);
        vi.mocked(toCanvas).mockResolvedValue(document.createElement('canvas'));
        const block = collectChatGPTRichBlockSurfaces(root)[0].block;
        const lease = await prepareRichContentAssets([block], { resolveMessageRoot: () => root });
        expect(lease.failures).toEqual([{ blockId: block.id, reason: 'unsafe-resource' }]);
        expect(toCanvas).not.toHaveBeenCalled();
        expect(fetch).not.toHaveBeenCalled();
    });

    it('keeps unique local SVG definitions closed and removes the library global-symbol repair trigger', async () => {
        const root = mountedRoot('<div data-testid="chatgpt-chart-content-reference"><svg width="100" height="80" xmlns:xlink="http://www.w3.org/1999/xlink"><defs><g id="local-symbol"><rect width="10" height="10"/></g></defs><use xlink:href="#local-symbol"/></svg></div>');
        vi.spyOn(root.firstElementChild!, 'getBoundingClientRect').mockReturnValue({ width: 100, height: 80 } as DOMRect);
        vi.mocked(toCanvas).mockImplementation(async node => {
            const use = node.querySelector('use')!;
            expect(use.getAttribute('xlink:href')).toBeNull();
            expect(use.getAttribute('href')).toBe('#local-symbol');
            expect(node.querySelectorAll('[id="local-symbol"]')).toHaveLength(1);
            const canvas = document.createElement('canvas'); canvas.width = 100; canvas.height = 80; return canvas;
        });
        const lease = await prepareRichContentAssets([collectChatGPTRichBlockSurfaces(root)[0].block], { resolveMessageRoot: () => root });
        expect(lease.assets).toHaveLength(1);
        expect(lease.failures).toEqual([]);
        lease.release();
    });

    it('rejects duplicate SVG definitions instead of choosing one by DOM order', async () => {
        const root = mountedRoot('<div data-testid="chatgpt-chart-content-reference"><svg width="100" height="80"><defs><g id="duplicate"/><g id="duplicate"/></defs><use href="#duplicate"/></svg></div>');
        vi.spyOn(root.firstElementChild!, 'getBoundingClientRect').mockReturnValue({ width: 100, height: 80 } as DOMRect);
        const block = collectChatGPTRichBlockSurfaces(root)[0].block;
        const lease = await prepareRichContentAssets([block], { resolveMessageRoot: () => root });
        expect(lease.failures).toEqual([{ blockId: block.id, reason: 'unsafe-resource' }]);
        expect(toCanvas).not.toHaveBeenCalled();
    });

    it('bounds cumulative generated image data before the remaining resources or HTML renderer run', async () => {
        vi.spyOn(performance, 'now').mockReturnValue(0);
        const root = mountedRoot('<div data-testid="chatgpt-chart-content-reference"><canvas width="100" height="80"></canvas><canvas width="100" height="80"></canvas><canvas width="100" height="80"></canvas></div>');
        vi.spyOn(root.firstElementChild!, 'getBoundingClientRect').mockReturnValue({ width: 100, height: 80 } as DOMRect);
        vi.mocked(HTMLCanvasElement.prototype.toDataURL).mockReturnValue(`data:image/png;base64,${'A'.repeat(5 * 1024 * 1024)}`);
        vi.mocked(toCanvas).mockResolvedValue(document.createElement('canvas'));
        const block = collectChatGPTRichBlockSurfaces(root)[0].block;
        const lease = await prepareRichContentAssets([block], { resolveMessageRoot: () => root });
        expect(lease.failures).toEqual([{ blockId: block.id, reason: 'limit-exceeded' }]);
        expect(HTMLCanvasElement.prototype.toDataURL).toHaveBeenCalledTimes(2);
        expect(toCanvas).not.toHaveBeenCalled();
    });

    it('fits cumulative child raster pixels inside one HTML capture budget', async () => {
        const root = mountedRoot('<div data-testid="chatgpt-chart-content-reference"><canvas width="2000" height="2000"></canvas><canvas width="2000" height="2000"></canvas><canvas width="2000" height="2000"></canvas></div>');
        vi.spyOn(root.firstElementChild!, 'getBoundingClientRect').mockReturnValue({ width: 100, height: 80 } as DOMRect);
        vi.mocked(toCanvas).mockResolvedValue(document.createElement('canvas'));
        const lease = await prepareRichContentAssets([collectChatGPTRichBlockSurfaces(root)[0].block], { resolveMessageRoot: () => root });
        expect(lease.failures).toEqual([]);
        expect(drawImage.mock.calls.reduce((pixels, call) => pixels + call[3] * call[4], 0)).toBeLessThanOrEqual(8_000_000);
        lease.release();
    });

    it('stops synchronous clone work when its wall-clock budget is exhausted', async () => {
        const root = mountedRoot('<div data-testid="chatgpt-chart-content-reference">Chart</div>');
        vi.spyOn(root.firstElementChild!, 'getBoundingClientRect').mockReturnValue({ width: 100, height: 80 } as DOMRect);
        const block = collectChatGPTRichBlockSurfaces(root)[0].block;
        vi.spyOn(performance, 'now').mockReturnValueOnce(0).mockReturnValue(1_000);
        const lease = await prepareRichContentAssets([block], { resolveMessageRoot: () => root });
        expect(lease.failures).toEqual([{ blockId: block.id, reason: 'timeout' }]);
        expect(toCanvas).not.toHaveBeenCalled();
    });

    it('cancels in-progress HTML capture, removes its host, and releases a late canvas', async () => {
        const root = mountedRoot('<div data-testid="chatgpt-chart-content-reference">Chart</div>');
        const source = root.firstElementChild!;
        vi.spyOn(source, 'getBoundingClientRect').mockReturnValue({ width: 100, height: 80 } as DOMRect);
        const block = collectChatGPTRichBlockSurfaces(root)[0].block;
        let complete!: (canvas: HTMLCanvasElement) => void;
        vi.mocked(toCanvas).mockReturnValue(new Promise(resolve => { complete = resolve; }));
        const controller = new AbortController();
        const result = prepareRichContentAssets([block], { resolveMessageRoot: () => root, signal: controller.signal });
        const rejected = expect(result).rejects.toMatchObject({ name: 'AbortError' });
        await vi.waitFor(() => expect(toCanvas).toHaveBeenCalled());
        controller.abort();
        await rejected;
        await vi.waitFor(() => expect(document.querySelector('[data-aimd-rich-capture]')).toBeNull());
        const canvas = document.createElement('canvas');
        canvas.width = 100;
        canvas.height = 80;
        complete(canvas);
        await vi.waitFor(() => expect(canvas.width).toBe(1));
        expect(canvas.height).toBe(1);
    });

    it('keeps a shared sealed-SVG capture alive when one of two consumers cancels', async () => {
        const images: Array<{ onload: (() => void) | null }> = [];
        vi.stubGlobal('Image', class {
            onload: (() => void) | null = null;
            onerror: (() => void) | null = null;
            set src(value: string) { if (value) images.push(this); }
            removeAttribute() {}
        });
        const controller = new AbortController();
        const first = prepareRichContentAssets([svgBlock], { signal: controller.signal });
        const rejected = expect(first).rejects.toMatchObject({ name: 'AbortError' });
        const second = prepareRichContentAssets([svgBlock]);
        await vi.waitFor(() => expect(images).toHaveLength(1));
        controller.abort();
        await rejected;
        images[0].onload?.();
        const lease = await second;
        expect(lease.assets).toHaveLength(2);
        expect(lease.failures).toEqual([]);
        expect(drawImage).toHaveBeenCalledTimes(1);
        lease.release();
    });
});
