import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { printPdf } from '../../../../../src/drivers/content/export/printPdf';

const KATEX_CSS = '@font-face{font-family:KaTeX_Main;src:url(fonts/KaTeX_Main-Regular.woff2) format("woff2")}.katex{font-family:KaTeX_Main}';
const frameId = 'aimd-pdf-export-container-frame';

describe('printPdf', () => {
    let framePrint: ReturnType<typeof vi.fn>;
    let configureDocument: (doc: Document) => void;

    beforeEach(() => {
        document.body.innerHTML = '';
        vi.useFakeTimers();
        framePrint = vi.fn();
        configureDocument = () => {};
        vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb): number => { cb(0); return 0; });
        const append = document.body.appendChild.bind(document.body);
        vi.spyOn(document.body, 'appendChild').mockImplementation((node) => {
            const result = append(node);
            if (node instanceof HTMLIFrameElement) {
                node.contentWindow!.print = framePrint;
                configureDocument(node.contentDocument!);
            }
            return result;
        });
        vi.stubGlobal('browser', { runtime: { getURL: (path: string) => `chrome-extension://aimd/${path}` } });
    });

    afterEach(() => {
        document.body.innerHTML = '';
        vi.restoreAllMocks();
        vi.unstubAllGlobals();
        vi.useRealTimers();
    });

    function frame(): HTMLIFrameElement | null {
        return document.getElementById(frameId) as HTMLIFrameElement | null;
    }

    function mockKatexFetch(): void {
        vi.stubGlobal('fetch', vi.fn(async (url: string) => {
            if (url.endsWith('katex.min.css')) return new Response(KATEX_CSS, { status: 200 });
            if (url.endsWith('.woff2')) return new Response(new Uint8Array([1, 2, 3]).buffer, { status: 200 });
            return new Response('', { status: 404 });
        }));
    }

    it('no-ops when plan html is empty', async () => {
        await printPdf({ html: '' });
        expect(framePrint).not.toHaveBeenCalled();
        expect(frame()).toBeNull();
    });

    it('prints an isolated document without invoking the host beforeprint handlers', async () => {
        const hostPrint = vi.spyOn(window, 'print').mockImplementation(() => {});
        const hostBeforePrint = vi.fn();
        window.addEventListener('beforeprint', hostBeforePrint);
        document.head.insertAdjacentHTML('beforeend', '<style id="host-print-style">@media print {body > div {display:none !important}}</style>');
        await printPdf({ html: '<div>single-message-answer</div>' });
        expect(frame()?.contentDocument?.body.textContent).toContain('single-message-answer');
        expect(frame()?.contentDocument?.getElementById('host-print-style')).toBeNull();
        expect(document.getElementById('aimd-pdf-export-container')).toBeNull();
        expect(hostPrint).not.toHaveBeenCalled();
        expect(hostBeforePrint).not.toHaveBeenCalled();
        expect(framePrint).toHaveBeenCalledTimes(1);
        window.removeEventListener('beforeprint', hostBeforePrint);
        document.getElementById('host-print-style')?.remove();
    });

    it('cleans up on the frame afterprint, not an unrelated host print event', async () => {
        await printPdf({ html: '<div>hello</div>' });
        window.dispatchEvent(new Event('afterprint'));
        expect(frame()).not.toBeNull();
        frame()!.contentWindow!.dispatchEvent(new Event('afterprint'));
        expect(frame()).toBeNull();
    });

    it('retains visual resource ownership until actual print context cleanup', async () => {
        const release = vi.fn();
        await printPdf({ html: '<div>rich output</div>' }, { onCleanup: release });
        expect(release).not.toHaveBeenCalled();
        window.dispatchEvent(new Event('afterprint'));
        expect(release).not.toHaveBeenCalled();
        const printWindow = frame()!.contentWindow!;
        printWindow.dispatchEvent(new Event('afterprint'));
        printWindow.dispatchEvent(new Event('afterprint'));
        expect(release).toHaveBeenCalledTimes(1);
    });

    it('embeds local KaTeX CSS and fonts into the print document', async () => {
        mockKatexFetch();
        await printPdf({ html: '<span class="katex">x</span>' });
        const style = frame()?.contentDocument?.querySelector('style[data-aimd-katex-export-css="1"]');
        expect(style?.textContent).toContain('font-family:KaTeX_Main');
        expect(style?.textContent).toContain('data:font/woff2;base64');
        expect(document.querySelector('style[data-aimd-katex-export-css="1"]')).toBeNull();
        expect(framePrint).toHaveBeenCalledTimes(1);
    });

    it('waits for the print document fonts rather than host fonts', async () => {
        let resolveFonts!: () => void;
        configureDocument = (doc) => Object.defineProperty(doc, 'fonts', {
            configurable: true,
            value: { ready: new Promise<void>((resolve) => { resolveFonts = resolve; }) },
        });
        const promise = printPdf({ html: '<div>hello</div>' });
        await Promise.resolve();
        expect(framePrint).not.toHaveBeenCalled();
        resolveFonts();
        await promise;
        expect(framePrint).toHaveBeenCalledTimes(1);
    });

    it('bounds font readiness so unavailable fonts do not block printing', async () => {
        configureDocument = (doc) => Object.defineProperty(doc, 'fonts', { value: { ready: new Promise(() => {}) } });
        const promise = printPdf({ html: '<div>hello</div>' });
        await vi.advanceTimersByTimeAsync(1500);
        await promise;
        expect(framePrint).toHaveBeenCalledTimes(1);
    });

    it('waits for an exported image before opening print preview', async () => {
        const promise = printPdf({ html: '<img src="https://example.com/slow.png" alt="Diagram">' });
        await vi.advanceTimersByTimeAsync(0);
        const image = frame()!.contentDocument!.querySelector('img')!;
        expect(framePrint).not.toHaveBeenCalled();
        Object.defineProperties(image, {
            complete: { value: true, configurable: true },
            naturalWidth: { value: 400, configurable: true },
        });
        image.dispatchEvent(new Event('load'));
        await promise;
        expect(framePrint).toHaveBeenCalledTimes(1);
        expect(frame()!.contentDocument!.querySelector('img')).toBe(image);
        expect(frame()!.contentDocument!.querySelector('.pdf-image-unavailable')).toBeNull();
    });

    it('bounds image loading and preserves the image description on failure', async () => {
        const promise = printPdf({ html: '<img src="https://example.com/slow.png" alt="Signal diagram">' });
        await vi.advanceTimersByTimeAsync(2000);
        await promise;
        expect(framePrint).toHaveBeenCalledTimes(1);
        expect(frame()!.contentDocument!.body.textContent).toContain('Signal diagram');
        expect(vi.getTimerCount()).toBe(1);
    });

    it('keeps a localized description instead of the failed image URL', async () => {
        const promise = printPdf({
            html: '<img src="https://example.com/private-link.png" alt="流程图">',
            imageUnavailableLabel: '图片未能加载',
        });
        await vi.advanceTimersByTimeAsync(0);
        frame()!.contentDocument!.querySelector('img')!.dispatchEvent(new Event('error'));
        await promise;
        expect(frame()!.contentDocument!.body.textContent).toContain('图片未能加载: 流程图');
        expect(frame()!.contentDocument!.body.textContent).not.toContain('private-link');
    });

    it('retains the document while preview is active and cleans up when idle', async () => {
        await printPdf({ html: '<div>hello</div>' });
        const media = { matches: true };
        frame()!.contentWindow!.matchMedia = vi.fn(() => media as MediaQueryList);
        vi.advanceTimersByTime(30000);
        expect(frame()).not.toBeNull();
        media.matches = false;
        vi.advanceTimersByTime(30000);
        expect(frame()).toBeNull();
    });

    it('cleans up when printing completes synchronously', async () => {
        framePrint.mockImplementation(() => frame()!.contentWindow!.dispatchEvent(new Event('afterprint')));
        await printPdf({ html: '<div>hello</div>' });
        expect(frame()).toBeNull();
        expect(vi.getTimerCount()).toBe(0);
    });

    it('propagates print failures and removes the frame', async () => {
        framePrint.mockImplementation(() => { throw new Error('print-fail'); });
        await expect(printPdf({ html: '<div>hello</div>' })).rejects.toThrow('print-fail');
        expect(frame()).toBeNull();
    });
});
