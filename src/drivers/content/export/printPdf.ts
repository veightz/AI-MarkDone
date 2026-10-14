import { getKatexCssWithEmbeddedFonts, getKatexStylesheetHref, hasKatexMarkup } from '../../../core/export/katexAssets';

export type PdfPrintPlan = {
    html: string;
    containerId?: string;
    imageUnavailableLabel?: string;
};

const DEFAULT_CONTAINER_ID = 'aimd-pdf-export-container';
const KATEX_STYLESHEET_TIMEOUT_MS = 1000;
const FONT_READY_TIMEOUT_MS = 1500;
const IMAGE_READY_TIMEOUT_MS = 2000;
const activePrintCleanups = new Map<string, () => void>();

async function preparePrintImages(container: HTMLElement, unavailableLabel: string): Promise<void> {
    await Promise.all(Array.from(container.querySelectorAll<HTMLImageElement>('img')).map(async (image) => {
        image.loading = 'eager';
        if (!image.complete) {
            await new Promise<void>((resolve) => {
                const done = () => {
                    image.removeEventListener('load', done);
                    image.removeEventListener('error', done);
                    window.clearTimeout(timer);
                    resolve();
                };
                const timer = window.setTimeout(done, IMAGE_READY_TIMEOUT_MS);
                image.addEventListener('load', done, { once: true });
                image.addEventListener('error', done, { once: true });
                if (image.complete) done();
            });
        }
        if (image.complete && image.naturalWidth > 0) return;
        const placeholder = container.ownerDocument.createElement('p');
        placeholder.className = 'pdf-image-unavailable';
        placeholder.textContent = image.alt ? `${unavailableLabel}: ${image.alt}` : unavailableLabel;
        image.replaceWith(placeholder);
    }));
}

function fitWidePrintFormulas(container: HTMLElement, originalSizes: Map<HTMLElement, string>): void {
    const printWindow = container.ownerDocument.defaultView;
    if (!printWindow) return;
    for (const display of Array.from(container.querySelectorAll<HTMLElement>('.katex-display'))) {
        const formula = display.querySelector<HTMLElement>('.katex');
        if (!formula) continue;
        if (!originalSizes.has(formula)) originalSizes.set(formula, formula.style.fontSize);
        formula.style.fontSize = originalSizes.get(formula)!;
        const availableWidth = display.clientWidth;
        const formulaWidth = Math.max(formula.scrollWidth, formula.getBoundingClientRect().width);
        const fontSize = Number.parseFloat(printWindow.getComputedStyle(formula).fontSize);
        if (availableWidth <= 0 || formulaWidth <= availableWidth || !Number.isFinite(fontSize)) continue;
        // Font sizing preserves normal document flow and selectable formula text.
        formula.style.fontSize = `${fontSize * availableWidth / formulaWidth}px`;
    }
}

async function waitForDocumentFonts(printDocument: Document): Promise<void> {
    try {
        const fonts = (printDocument as Document & { fonts?: { ready?: Promise<unknown> } }).fonts;
        if (!fonts?.ready) return;
        let timer: number | null = null;
        await Promise.race([
            fonts.ready,
            new Promise<void>((resolve) => {
                timer = window.setTimeout(resolve, FONT_READY_TIMEOUT_MS);
            }),
        ]);
        if (timer !== null) window.clearTimeout(timer);
    } catch {
        // Font readiness is best-effort; the print dialog should still open.
    }
}

function injectKatexStylesheetLink(container: HTMLElement): Promise<void> {
    const link = container.ownerDocument.createElement('link');
    link.rel = 'stylesheet';
    link.href = getKatexStylesheetHref();
    link.dataset.aimdKatexExportCss = '1';

    return new Promise<void>((resolve) => {
        let settled = false;
        let timer: number | null = null;
        const done = () => {
            if (settled) return;
            settled = true;
            link.removeEventListener('load', done);
            link.removeEventListener('error', done);
            if (timer !== null) {
                window.clearTimeout(timer);
                timer = null;
            }
            resolve();
        };

        link.addEventListener('load', done, { once: true });
        link.addEventListener('error', done, { once: true });
        timer = window.setTimeout(done, KATEX_STYLESHEET_TIMEOUT_MS);
        container.prepend(link);
    });
}

async function injectKatexStylesheetIfNeeded(container: HTMLElement, html: string): Promise<void> {
    if (!hasKatexMarkup(html)) return Promise.resolve();

    try {
        const fontEmbed = await getKatexCssWithEmbeddedFonts(html);
        if (fontEmbed.mode === 'data-url' && fontEmbed.css) {
            const style = container.ownerDocument.createElement('style');
            style.dataset.aimdKatexExportCss = '1';
            style.textContent = fontEmbed.css;
            container.prepend(style);
            return;
        }
    } catch {
        // Fall back to the local stylesheet URL so export remains best-effort.
    }

    await injectKatexStylesheetLink(container);
}

export async function printPdf(plan: PdfPrintPlan, options: { onCleanup?: () => void } = {}): Promise<void> {
    let released = false;
    const release = () => {
        if (released) return;
        released = true;
        options.onCleanup?.();
    };
    const html = (plan?.html || '').trim();
    if (!html) { release(); return; }

    const containerId = plan.containerId || DEFAULT_CONTAINER_ID;

    const frameId = `${containerId}-frame`;
    activePrintCleanups.get(frameId)?.();
    document.getElementById(frameId)?.remove();

    // Host beforeprint handlers can create a second document and hide ours.
    // Print only this same-origin frame so host handlers and CSS never participate.
    const frame = document.createElement('iframe');
    frame.id = frameId;
    frame.title = 'PDF export';
    frame.setAttribute('aria-hidden', 'true');
    // Match the common A4 printable width before the native print layout exists.
    frame.style.cssText = 'position: fixed; left: -10000px; width: 170mm; height: 1px; border: 0;';
    document.body.appendChild(frame);
    const printDocument = frame.contentDocument;
    const printWindow = frame.contentWindow;
    if (!printDocument || !printWindow) {
        frame.remove();
        release();
        throw new Error('PDF print document is unavailable.');
    }
    printDocument.title = document.title;
    printDocument.documentElement.lang = document.documentElement.lang;
    const printContainer = printDocument.createElement('div');
    printContainer.id = containerId;

    const parsed = new DOMParser().parseFromString(`<div id="aimd-pdf-root">${html}</div>`, 'text/html');
    const wrapper = parsed.getElementById('aimd-pdf-root');
    if (wrapper) {
        const fragment = printDocument.createDocumentFragment();
        Array.from(wrapper.childNodes).forEach((node) => fragment.appendChild(printDocument.importNode(node, true)));
        printContainer.replaceChildren(fragment);
    }

    printDocument.body.appendChild(printContainer);
    try {
        await injectKatexStylesheetIfNeeded(printContainer, html);
        await Promise.all([
            waitForDocumentFonts(printDocument),
            preparePrintImages(printContainer, plan.imageUnavailableLabel ?? 'Image unavailable'),
        ]);
    } catch (error) {
        frame.remove();
        release();
        throw error;
    }

    let cleaned = false;
    let cleanupTimer: number | null = null;
    const originalFormulaSizes = new Map<HTMLElement, string>();
    const prepareLayout = () => fitWidePrintFormulas(printContainer, originalFormulaSizes);

    const cleanup = (): void => {
        if (cleaned) return;
        cleaned = true;
        printWindow.removeEventListener('afterprint', cleanup);
        printWindow.removeEventListener('beforeprint', prepareLayout);
        if (cleanupTimer !== null) {
            window.clearTimeout(cleanupTimer);
            cleanupTimer = null;
        }
        frame.remove();
        if (activePrintCleanups.get(frameId) === cleanup) activePrintCleanups.delete(frameId);
        release();
    };

    activePrintCleanups.set(frameId, cleanup);

    printWindow.addEventListener('afterprint', cleanup);
    printWindow.addEventListener('beforeprint', prepareLayout);
    const cleanupWhenIdle = (): void => {
        // Some browsers return from print() while preview is still open.
        if (frame.isConnected && printWindow.matchMedia?.('print').matches) {
            cleanupTimer = window.setTimeout(cleanupWhenIdle, 30000);
        } else {
            cleanup();
        }
    };

    await new Promise<void>((resolve, reject) => {
        window.requestAnimationFrame(() => {
            window.requestAnimationFrame(() => {
                try {
                    if (!frame.isConnected) throw new Error('PDF print document was replaced.');
                    prepareLayout();
                    printWindow.print();
                    if (!cleaned) cleanupTimer = window.setTimeout(cleanupWhenIdle, 30000);
                    resolve();
                } catch (error) {
                    cleanup();
                    reject(error);
                }
            });
        });
    });
}
