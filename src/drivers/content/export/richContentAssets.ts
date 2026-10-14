import { isRichBlockV1, type RichBlockV1 } from '../../../contracts/richContent';
import { collectChatGPTRichBlockSurfaces } from '../chatgpt/chatgptRichContent';
import { getAdapter } from '../adapters/registry';
import { sanitizeLightweightSvg } from './sanitizeLightweightSvg';
import { isRenderAbortError, throwIfAborted } from './renderControl';
import { registerRichContentAssetDisposer } from './richContentAssetLifecycle';

export type RichContentAssetFailureReason = 'not-rendered' | 'cross-origin' | 'unsafe-resource' | 'unsupported'
    | 'source-changed' | 'capture-failed' | 'limit-exceeded' | 'timeout';
export type RichContentPreparedAsset = Readonly<{
    assetId: string;
    blockId: string;
    visualDigest: string;
    mimeType: 'image/svg+xml' | 'image/png';
    blob: Blob;
    objectUrl: string;
    widthPx: number;
    heightPx: number;
    filename: string;
}>;
export type RichContentAssetsLease = Readonly<{
    assets: readonly RichContentPreparedAsset[];
    failures: readonly Readonly<{ blockId: string; reason: RichContentAssetFailureReason }>[];
    release: () => void;
}>;
export type RichContentAssetPreparationOptions = {
    messageId?: string;
    documentUrl?: string;
    resolveMessageRoot?: () => HTMLElement | null;
    signal?: AbortSignal;
    timeoutMs?: number;
    deadlineMs?: number;
    onProgress?: (progress: { completed: number; total: number; blockId: string }) => void;
};

const MAX_BLOCKS = 64;
const MAX_ASSET_BYTES = 8 * 1024 * 1024;
const MAX_LEASE_BYTES = 24 * 1024 * 1024;
const MAX_CACHE_BYTES = 48 * 1024 * 1024;
const MAX_CACHE_ENTRIES = 128;
const MAX_PENDING_CAPTURES = 16;
const CACHE_TTL_MS = 120_000;
const MAX_CAPTURE_NODES = 2_000;
const MAX_CAPTURE_TEXT_UNITS = 262_144;
const MAX_GENERATED_DATA_BYTES = 8 * 1024 * 1024;
const MAX_SYNC_CLONE_MS = 300;
const MAX_CAPTURE_PIXELS = 8_000_000;
const MAX_CAPTURE_DIMENSION = 8_192;
const CAPTURE_STYLE_PROPERTIES = [
    'display', 'position', 'top', 'right', 'bottom', 'left', 'box-sizing',
    'width', 'height', 'min-width', 'min-height', 'max-width', 'max-height',
    'margin', 'padding', 'border', 'border-radius', 'border-collapse', 'border-spacing',
    'background-color', 'box-shadow', 'color', 'opacity', 'visibility',
    'font-family', 'font-size', 'font-style', 'font-weight', 'line-height',
    'letter-spacing', 'word-spacing', 'text-align', 'text-decoration', 'white-space',
    'overflow', 'overflow-wrap', 'word-break', 'vertical-align', 'list-style-type',
    'table-layout', 'transform', 'transform-origin', 'object-fit', 'aspect-ratio',
    'flex', 'flex-direction', 'flex-wrap', 'align-items', 'justify-content', 'gap',
    'grid-template-columns', 'grid-template-rows', 'grid-column', 'grid-row',
];

type CapturedVariant = Omit<RichContentPreparedAsset, 'objectUrl'>;
type CloneBudget = { nodes: number; textUnits: number; rasterPixels: number; generatedDataBytes: number; startedAt: number };
type Cached = { assets: readonly RichContentPreparedAsset[]; bytes: number; memoryBytes: number; ephemeral: boolean; refs: number; pendingConsumers: number; expiresAt: number };
type InFlight = { controller: AbortController; consumers: Set<symbol>; promise: Promise<Cached>; settled: boolean; reservedKeyBytes: number; ready?: Cached };
const cache = new Map<string, Cached>();
const inFlight = new Map<string, InFlight>();
let cacheBytes = 0;
let pendingKeyBytes = 0;
let actionSequence = 0;
let lifetimeGeneration = 0;
let expiryTimer: ReturnType<typeof setTimeout> | null = null;
let captureQueue: Promise<void> = Promise.resolve();

class CaptureFailure extends Error {
    constructor(readonly reason: RichContentAssetFailureReason) { super(reason); }
}

/** Captured bytes never enter the conversation pool; leases own only bounded, local static images. */
export async function prepareRichContentAssets(
    blocks: readonly RichBlockV1[],
    options: RichContentAssetPreparationOptions = {},
): Promise<RichContentAssetsLease> {
    throwIfAborted(options.signal);
    pruneCache();
    const actionId = ++actionSequence;
    const acquired: Cached[] = [];
    const assets: RichContentPreparedAsset[] = [];
    const failures: Array<{ blockId: string; reason: RichContentAssetFailureReason }> = [];
    let bytes = 0;
    const deadlineMs = Number.isFinite(options.deadlineMs) ? options.deadlineMs! : Date.now() + 30_000;
    let released = false;
    const release = () => {
        if (released) return;
        released = true;
        for (const entry of acquired) entry.refs -= 1;
        pruneCache();
    };
    try {
        for (const [index, block] of blocks.entries()) {
            throwIfAborted(options.signal);
            try {
                if (index >= MAX_BLOCKS || !isRichBlockV1(block)) throw new CaptureFailure('limit-exceeded');
                if (Date.now() >= deadlineMs) throw new CaptureFailure('timeout');
                if (block.source.kind === 'unavailable') throw new CaptureFailure(block.source.reason);
                const entry = await acquire(block, { ...options, deadlineMs }, actionId);
                if (bytes + entry.bytes > MAX_LEASE_BYTES) {
                    entry.refs -= 1;
                    pruneCache();
                    throw new CaptureFailure('limit-exceeded');
                }
                acquired.push(entry);
                assets.push(...entry.assets);
                bytes += entry.bytes;
            } catch (error) {
                if (isRenderAbortError(error)) throw error;
                failures.push({ blockId: block.id, reason: error instanceof CaptureFailure ? error.reason : 'capture-failed' });
            }
            options.onProgress?.({ completed: index + 1, total: blocks.length, blockId: block.id });
        }
        throwIfAborted(options.signal);
        return Object.freeze({ assets: Object.freeze(assets), failures: Object.freeze(failures), release });
    } catch (error) {
        release();
        throw error;
    }
}

async function acquire(block: RichBlockV1, options: RichContentAssetPreparationOptions, actionId: number): Promise<Cached> {
    const generation = lifetimeGeneration;
    const ephemeral = block.source.kind !== 'svg';
    // DOM digests cannot prove canvas, animated-image, CSS or theme pixels.
    // Only sealed SVG bytes can be reused across independent explicit actions.
    const evidence = block.source.kind === 'svg'
        ? ['svg', block.source.svg, block.source.width ?? null, block.source.height ?? null]
        : ['action', actionId];
    const key = JSON.stringify([documentScope(options.documentUrl), options.messageId ?? '', block.id, block.visualDigest, evidence]);
    const keyBytes = key.length * 2;
    const hit = cache.get(key);
    if (hit) {
        hit.refs += 1;
        hit.expiresAt = Date.now() + CACHE_TTL_MS;
        cache.delete(key);
        cache.set(key, hit);
        return hit;
    }
    let task = inFlight.get(key);
    if (!task) {
        pruneCache(keyBytes);
        if (inFlight.size >= MAX_PENDING_CAPTURES || cacheBytes + pendingKeyBytes + keyBytes > MAX_CACHE_BYTES) throw new CaptureFailure('limit-exceeded');
        const controller = new AbortController();
        const created: InFlight = { controller, consumers: new Set(), settled: false, reservedKeyBytes: keyBytes, promise: Promise.resolve(null as unknown as Cached) };
        pendingKeyBytes += keyBytes;
        const capture = captureQueue.then(async () => {
            throwIfAborted(controller.signal);
            const timeoutMs = Math.max(100, Math.min(10_000, options.timeoutMs ?? 5_000));
            let variants: CapturedVariant[];
            try {
                variants = await bounded(captureBlock(block, options.resolveMessageRoot, controller.signal), controller.signal, timeoutMs);
            } catch (error) {
                controller.abort();
                throw error;
            }
            throwIfAborted(controller.signal);
            const bytes = variants.reduce((sum, variant) => sum + variant.blob.size, 0);
            pruneCache(bytes);
            if (cacheBytes + pendingKeyBytes + bytes > MAX_CACHE_BYTES || cache.size >= MAX_CACHE_ENTRIES) throw new CaptureFailure('limit-exceeded');
            releaseKeyReservation(created);
            const assets: RichContentPreparedAsset[] = [];
            try {
                for (const variant of variants) assets.push(Object.freeze({ ...variant, objectUrl: URL.createObjectURL(variant.blob) }));
            } catch (error) {
                for (const asset of assets) URL.revokeObjectURL(asset.objectUrl);
                throw error;
            }
            const entry = { assets: Object.freeze(assets), bytes, memoryBytes: bytes + keyBytes, ephemeral, refs: 0, pendingConsumers: created.consumers.size, expiresAt: Date.now() + CACHE_TTL_MS };
            created.ready = entry;
            cache.set(key, entry);
            cacheBytes += entry.memoryBytes;
            return entry;
        });
        captureQueue = capture.then(() => undefined, () => undefined);
        created.promise = capture.finally(() => {
            created.settled = true;
            releaseKeyReservation(created);
            if (inFlight.get(key) === created) inFlight.delete(key);
        });
        task = created;
        inFlight.set(key, task);
    }
    const active = task;
    const consumer = Symbol();
    active.consumers.add(consumer);
    try {
        const remaining = Math.max(1, (options.deadlineMs ?? Date.now() + 30_000) - Date.now());
        const entry = await bounded(active.promise, options.signal, remaining);
        throwIfAborted(options.signal);
        if (generation !== lifetimeGeneration) throw new DOMException('Asset owner disposed.', 'AbortError');
        entry.refs += 1;
        return entry;
    } finally {
        active.consumers.delete(consumer);
        if (active.ready) active.ready.pendingConsumers = active.consumers.size;
        if (!active.settled && active.consumers.size === 0) active.controller.abort();
        if (active.settled) pruneCache();
    }
}

function pruneCache(incomingBytes = 0): void {
    if (expiryTimer !== null) clearTimeout(expiryTimer);
    expiryTimer = null;
    const now = Date.now();
    for (const [key, entry] of cache) {
        if (entry.refs > 0 || entry.pendingConsumers > 0 || (!entry.ephemeral && entry.expiresAt > now
            && cacheBytes + pendingKeyBytes + incomingBytes <= MAX_CACHE_BYTES && cache.size < MAX_CACHE_ENTRIES)) continue;
        for (const asset of entry.assets) URL.revokeObjectURL(asset.objectUrl);
        cache.delete(key);
        cacheBytes -= entry.memoryBytes;
    }
    const deadlines = Array.from(cache.values()).filter(entry => entry.refs === 0).map(entry => entry.expiresAt);
    if (deadlines.length > 0) expiryTimer = setTimeout(() => pruneCache(), Math.max(1, Math.min(...deadlines) - now));
}

function releaseKeyReservation(task: InFlight): void {
    pendingKeyBytes -= task.reservedKeyBytes;
    task.reservedKeyBytes = 0;
}

function liveSurface(block: RichBlockV1, resolve?: () => HTMLElement | null): Element {
    const root = resolve?.();
    if (!root?.isConnected) throw new CaptureFailure('not-rendered');
    assertDomBudget(root, 20_000, 2_000_000);
    const match = collectChatGPTRichBlockSurfaces(root).find(surface => surface.block.id === block.id);
    if (!match || match.block.visualDigest !== block.visualDigest) throw new CaptureFailure('source-changed');
    return match.element;
}

/** Use the Adapter's existing selectors and exact role identity; never match a message by visible text or ordinal. */
export function resolveRichContentMessageRoot(context: { messageId?: string; documentUrl?: string }): HTMLElement | null {
    const messageId = context.messageId?.trim();
    if (!messageId) return null;
    const current = window.location.href;
    try {
        if (context.documentUrl) {
            const expected = new URL(context.documentUrl);
            const actual = new URL(current);
            if (expected.origin !== actual.origin || expected.pathname !== actual.pathname) return null;
        }
        const adapter = getAdapter(current);
        if (!adapter || adapter.getPlatformId() !== 'chatgpt') return null;
        const candidates: HTMLElement[] = [];
        for (const element of Array.from(document.querySelectorAll<HTMLElement>(adapter.getMessageSelector()))) {
            const ids = new Set(['data-message-id', 'data-chatgpt-search-message-ids']
                .flatMap(attribute => element.getAttribute(attribute)?.trim().split(/\s+/).filter(Boolean) ?? []));
            if (!ids.has(messageId)) continue;
            if (ids.size !== 1) return null;
            candidates.push(element);
        }
        if (candidates.length !== 1) return null;
        const message = candidates[0];
        const selector = adapter.getMessageContentSelector();
        const root = selector ? message.matches(selector) ? message : message.querySelector(selector) : message;
        return root instanceof HTMLElement && root.isConnected ? root : null;
    } catch {
        return null;
    }
}

async function captureBlock(block: RichBlockV1, resolve: (() => HTMLElement | null) | undefined, signal: AbortSignal): Promise<CapturedVariant[]> {
    if (block.source.kind === 'svg') {
        const safe = sanitizeLightweightSvg(block.source.svg);
        if (safe.kind !== 'ready') throw new CaptureFailure(safe.reason);
        const svgRoot = new DOMParser().parseFromString(safe.svg, 'image/svg+xml').documentElement;
        closeSvgReferences(svgRoot);
        const svgText = new XMLSerializer().serializeToString(svgRoot);
        const size = safeSize(safe.width ?? block.source.width ?? 800, safe.height ?? block.source.height ?? 400);
        const svg = variant(block, new Blob([svgText], { type: 'image/svg+xml' }), size.width, size.height);
        try {
            const png = await rasterSvg(svgText, size, signal);
            return [svg, variant(block, png, size.width, size.height)];
        } catch (error) {
            if (isRenderAbortError(error)) throw error;
            return [svg];
        }
    }
    const element = liveSurface(block, resolve);
    let captured: { blob: Blob; width: number; height: number };
    if (block.source.kind === 'loaded-image') {
        if (!(element instanceof HTMLImageElement) || !element.complete || element.naturalWidth <= 0) throw new CaptureFailure('not-rendered');
        captured = await rasterElement(element, element.naturalWidth, element.naturalHeight, signal);
    } else if (block.source.kind === 'dom-capture' && block.source.surface === 'canvas') {
        if (!(element instanceof HTMLCanvasElement)) throw new CaptureFailure('source-changed');
        captured = await rasterElement(element, element.width, element.height, signal);
    } else if (block.source.kind === 'dom-capture' && block.source.surface === 'html') {
        captured = await rasterHtml(element, signal);
    } else {
        throw new CaptureFailure(block.source.kind === 'dom-capture' ? 'cross-origin' : 'unsupported');
    }
    // A live widget may change while its bitmap is decoding. Never associate
    // that newer state with a previously sealed message.
    liveSurface(block, resolve);
    throwIfAborted(signal);
    return [variant(block, captured.blob, captured.width, captured.height)];
}

function variant(block: RichBlockV1, blob: Blob, widthPx: number, heightPx: number): CapturedVariant {
    if (blob.size < 1 || blob.size > MAX_ASSET_BYTES) throw new CaptureFailure('limit-exceeded');
    const extension = blob.type === 'image/svg+xml' ? 'svg' : 'png';
    const filename = `${block.id.slice(0, 128)}-${block.visualDigest.slice(0, 128)}.${extension}`;
    return { assetId: filename, blockId: block.id, visualDigest: block.visualDigest,
        mimeType: extension === 'svg' ? 'image/svg+xml' : 'image/png', blob, widthPx, heightPx, filename };
}

function safeSize(width: number, height: number): { width: number; height: number } {
    width = Math.ceil(width);
    height = Math.ceil(height);
    if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0
        || width > MAX_CAPTURE_DIMENSION || height > MAX_CAPTURE_DIMENSION || width * height > MAX_CAPTURE_PIXELS) throw new CaptureFailure('limit-exceeded');
    return { width, height };
}

function rasterSize(width: number, height: number): { width: number; height: number } {
    if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0
        || width > 16_384 || height > 16_384) throw new CaptureFailure('limit-exceeded');
    const scale = Math.min(1, MAX_CAPTURE_DIMENSION / width, MAX_CAPTURE_DIMENSION / height, Math.sqrt(MAX_CAPTURE_PIXELS / (width * height)));
    return safeSize(Math.max(1, Math.floor(width * scale)), Math.max(1, Math.floor(height * scale)));
}

function documentScope(url?: string): string {
    if (!url) return '';
    try { const parsed = new URL(url); return `${parsed.origin}${parsed.pathname}`; }
    catch { return url; }
}

async function rasterElement(source: CanvasImageSource, width: number, height: number, signal: AbortSignal): Promise<{ blob: Blob; width: number; height: number }> {
    const size = rasterSize(width, height);
    const canvas = document.createElement('canvas');
    canvas.width = size.width;
    canvas.height = size.height;
    try {
        throwIfAborted(signal);
        const context = canvas.getContext('2d');
        if (!context) throw new CaptureFailure('capture-failed');
        context.drawImage(source, 0, 0, size.width, size.height);
        const blob = await bounded(canvasBlob(canvas), signal, 2_500);
        return { blob, ...size };
    } catch (error) {
        if (error instanceof DOMException && error.name === 'SecurityError') throw new CaptureFailure('cross-origin');
        throw error;
    } finally {
        canvas.width = 1;
        canvas.height = 1;
    }
}

async function rasterSvg(svg: string, size: { width: number; height: number }, signal: AbortSignal): Promise<Blob> {
    const objectUrl = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
    const image = new Image();
    try {
        const loaded = new Promise<void>((resolve, reject) => {
            image.onload = () => resolve();
            image.onerror = () => reject(new CaptureFailure('capture-failed'));
            image.src = objectUrl;
        });
        await bounded(loaded, signal, 2_500);
        return (await rasterElement(image, size.width, size.height, signal)).blob;
    } finally {
        image.onload = null;
        image.onerror = null;
        image.removeAttribute('src');
        URL.revokeObjectURL(objectUrl);
    }
}

function canvasBlob(canvas: HTMLCanvasElement): Promise<Blob> {
    return new Promise((resolve, reject) => {
        canvas.toBlob(blob => blob ? resolve(blob) : reject(new CaptureFailure('capture-failed')), 'image/png');
    });
}

async function rasterHtml(source: Element, signal: AbortSignal): Promise<{ blob: Blob; width: number; height: number }> {
    const rect = source.getBoundingClientRect();
    const size = safeSize(rect.width, rect.height);
    assertDomBudget(source, MAX_CAPTURE_NODES, MAX_CAPTURE_TEXT_UNITS);
    const holder = document.createElement('div');
    holder.setAttribute('data-aimd-rich-capture', 'true');
    holder.style.cssText = 'position:fixed;left:-10000px;top:0;pointer-events:none;';
    const shadow = holder.attachShadow({ mode: 'open' });
    const clone = controlledClone(source, { nodes: 0, textUnits: 0, rasterPixels: 0, generatedDataBytes: 0, startedAt: performance.now() }, signal) as HTMLElement;
    closeSvgReferences(clone);
    clone.style.width = `${size.width}px`;
    clone.style.height = `${size.height}px`;
    clone.style.margin = '0';
    clone.style.position = 'relative';
    clone.style.top = '0';
    clone.style.left = '0';
    clone.style.transform = 'none';
    shadow.append(clone);
    document.body.append(holder);
    let canvas: HTMLCanvasElement | null = null;
    let abandoned = false;
    try {
        const { toCanvas } = await import('html-to-image');
        throwIfAborted(signal);
        const capture = toCanvas(clone, {
            width: size.width, height: size.height, pixelRatio: 1, skipAutoScale: true,
            skipFonts: true, fontEmbedCSS: '', includeStyleProperties: [], cacheBust: false,
        }).then(result => {
            if (abandoned) { result.width = 1; result.height = 1; }
            return result;
        });
        canvas = await bounded(capture, signal, 3_000);
        const blob = await bounded(canvasBlob(canvas), signal, 2_500);
        return { blob, ...size };
    } finally {
        abandoned = true;
        if (canvas) { canvas.width = 1; canvas.height = 1; }
        holder.remove();
    }
}

function controlledClone(source: Node, budget: CloneBudget, signal: AbortSignal): Node {
    throwIfAborted(signal);
    assertCloneBudget(budget);
    if (++budget.nodes > MAX_CAPTURE_NODES) throw new CaptureFailure('limit-exceeded');
    if (source.nodeType === Node.TEXT_NODE) {
        const text = source.textContent ?? '';
        budget.textUnits += text.length;
        if (budget.textUnits > MAX_CAPTURE_TEXT_UNITS) throw new CaptureFailure('limit-exceeded');
        return document.createTextNode(text);
    }
    if (!(source instanceof Element)) return document.createTextNode('');
    if (source.matches('script, style, link, object, embed, iframe, audio, video, source, [data-aimd-role]')) return document.createTextNode('');
    if (source instanceof HTMLImageElement || source instanceof HTMLCanvasElement) {
        const image = document.createElement('img');
        try {
            const width = source instanceof HTMLImageElement ? source.naturalWidth : source.width;
            const height = source instanceof HTMLImageElement ? source.naturalHeight : source.height;
            if (source instanceof HTMLImageElement && (!source.complete || width <= 0)) throw new CaptureFailure('not-rendered');
            const size = inlineRasterSize(width, height, budget);
            budget.rasterPixels += size.width * size.height;
            assertCloneBudget(budget);
            const canvas = document.createElement('canvas');
            canvas.width = size.width;
            canvas.height = size.height;
            try {
                const context = canvas.getContext('2d');
                if (!context) throw new CaptureFailure('capture-failed');
                context.drawImage(source, 0, 0, size.width, size.height);
                assertCloneBudget(budget);
                const dataUrl = canvas.toDataURL('image/png');
                budget.generatedDataBytes += dataUrl.length;
                assertCloneBudget(budget);
                image.src = dataUrl;
            } finally { canvas.width = 1; canvas.height = 1; }
            copyStyles(source, image);
            return image;
        } catch (error) {
            if (error instanceof CaptureFailure && (error.reason === 'limit-exceeded' || error.reason === 'timeout')) throw error;
            return document.createTextNode(source instanceof HTMLImageElement ? source.alt || 'Image unavailable' : 'Canvas unavailable');
        }
    }
    if (source instanceof SVGElement) {
        return controlledSvgClone(source, budget, signal);
    }
    const tag = /^(?:div|span|p|section|article|header|footer|h[1-6]|ul|ol|li|table|thead|tbody|tfoot|tr|th|td|caption|strong|em|b|i|small|pre|code|blockquote|br|hr|dl|dt|dd|label|sub|sup)$/.test(source.localName) ? source.localName : 'span';
    const clone = document.createElement(tag);
    copyStyles(source, clone);
    for (let child = source.firstChild; child; child = child.nextSibling) clone.append(controlledClone(child, budget, signal));
    return clone;
}

function controlledSvgClone(source: SVGElement, budget: CloneBudget, signal: AbortSignal): Node {
    const namespace = 'http://www.w3.org/2000/svg';
    let clone: SVGElement;
    if (source.localName.toLowerCase() === 'foreignobject') {
        // A bitmap may contain inert XHTML labels even though an archival SVG
        // must reject foreignObject. Reconstruct labels through the same zero-fetch clone.
        clone = document.createElementNS(namespace, 'foreignObject');
        for (const name of ['x', 'y', 'width', 'height']) {
            const value = source.getAttribute(name);
            if (value && /^-?(?:\d+\.?\d*|\.\d+)(?:px|%)?$/.test(value)) clone.setAttribute(name, value);
        }
    } else {
        const shallow = source.cloneNode(false) as SVGElement;
        const href = source.getAttribute('href');
        const xlink = source.getAttribute('xlink:href') ?? source.getAttributeNS('http://www.w3.org/1999/xlink', 'href');
        if (href && xlink && href !== xlink) throw new CaptureFailure('unsafe-resource');
        shallow.removeAttribute('xlink:href');
        shallow.removeAttributeNS('http://www.w3.org/1999/xlink', 'href');
        if (xlink) shallow.setAttribute('href', xlink);
        shallow.removeAttribute('class');
        shallow.removeAttribute('style');
        const computed = getComputedStyle(source);
        for (const property of ['fill', 'stroke', 'color', 'font-family', 'font-size', 'font-weight']) {
            const value = computed.getPropertyValue(property);
            if (value && !/url\s*\(|var\s*\(|currentcolor/i.test(value)) shallow.setAttribute(property, value);
            else if (/var\s*\(|currentcolor/i.test(shallow.getAttribute(property) ?? '')) shallow.removeAttribute(property);
        }
        const input = source.localName === 'svg' ? shallow.outerHTML : `<svg xmlns="${namespace}">${shallow.outerHTML}</svg>`;
        const safe = sanitizeLightweightSvg(input);
        if (safe.kind !== 'ready') return document.createTextNode('');
        const parsed = new DOMParser().parseFromString(safe.svg, 'image/svg+xml').documentElement;
        clone = document.importNode(source.localName === 'svg' ? parsed : parsed.firstElementChild!, true) as SVGElement;
    }
    copyStyles(source, clone as unknown as HTMLElement);
    const computed = getComputedStyle(source);
    for (const property of ['fill', 'stroke', 'stroke-width', 'fill-opacity', 'stroke-opacity', 'text-anchor', 'dominant-baseline']) {
        const value = computed.getPropertyValue(property);
        if (value && !/url\s*\(/i.test(value)) clone.style.setProperty(property, value);
    }
    for (let child = source.firstChild; child; child = child.nextSibling) clone.append(controlledClone(child, budget, signal));
    return clone;
}

function assertCloneBudget(budget: CloneBudget): void {
    if (budget.rasterPixels > MAX_CAPTURE_PIXELS || budget.generatedDataBytes > MAX_GENERATED_DATA_BYTES) throw new CaptureFailure('limit-exceeded');
    if (performance.now() - budget.startedAt > MAX_SYNC_CLONE_MS) throw new CaptureFailure('timeout');
}

function inlineRasterSize(width: number, height: number, budget: CloneBudget): { width: number; height: number } {
    assertCloneBudget(budget);
    const base = rasterSize(width, height);
    const remainingPixels = MAX_CAPTURE_PIXELS - budget.rasterPixels;
    // Reserve a conservative PNG/base64 upper bound before synchronous encoding.
    const encodablePixels = Math.floor((MAX_GENERATED_DATA_BYTES - budget.generatedDataBytes - 8_192) * 3 / 20);
    const allowed = Math.min(remainingPixels, encodablePixels);
    if (allowed < 1) throw new CaptureFailure('limit-exceeded');
    const scale = Math.min(1, Math.sqrt(allowed / (base.width * base.height)));
    const size = safeSize(Math.max(1, Math.floor(base.width * scale)), Math.max(1, Math.floor(base.height * scale)));
    if (size.width * size.height > allowed) throw new CaptureFailure('limit-exceeded');
    return size;
}

function closeSvgReferences(root: Element): void {
    const elements = [root, ...Array.from(root.querySelectorAll('*'))];
    const ids = new Map<string, Element[]>();
    for (const element of elements) {
        const id = element.getAttribute('id');
        if (id) {
            const matches = ids.get(id);
            if (matches) matches.push(element);
            else ids.set(id, [element]);
        }
    }
    for (const use of elements.filter(element => element.namespaceURI === 'http://www.w3.org/2000/svg' && element.localName === 'use')) {
        const href = use.getAttribute('href');
        const xlink = use.getAttribute('xlink:href') ?? use.getAttributeNS('http://www.w3.org/1999/xlink', 'href');
        if (href && xlink && href !== xlink) throw new CaptureFailure('unsafe-resource');
        const reference = href || xlink;
        if (!reference) continue;
        const definitions = reference.startsWith('#') ? ids.get(reference.slice(1)) ?? [] : [];
        const owner = use.closest('svg');
        if (definitions.length !== 1 || !owner?.contains(definitions[0]) || definitions[0].contains(use)) throw new CaptureFailure('unsafe-resource');
        // html-to-image's xlink repair path consults the global document. Modern
        // SVG href keeps already proven local definitions inside this static clone.
        use.removeAttribute('xlink:href');
        use.removeAttributeNS('http://www.w3.org/1999/xlink', 'href');
        use.setAttribute('href', reference);
    }
}

function copyStyles(source: Element, target: HTMLElement): void {
    const computed = getComputedStyle(source);
    for (const property of CAPTURE_STYLE_PROPERTIES) {
        const value = computed.getPropertyValue(property);
        if (value && value.length <= 4_096 && !/url\s*\(|@|expression\s*\(|javascript\s*:/i.test(value)) target.style.setProperty(property, value);
    }
    target.style.backgroundImage = 'none';
    target.style.setProperty('mask-image', 'none');
    target.style.setProperty('-webkit-mask-image', 'none');
    target.style.animation = 'none';
    target.style.transition = 'none';
}

function assertDomBudget(root: Element, maxNodes: number, maxTextUnits: number): void {
    const walker = root.ownerDocument.createTreeWalker(root, NodeFilter.SHOW_ALL);
    let nodes = 1;
    let textUnits = 0;
    let node: Node | null;
    while ((node = walker.nextNode())) {
        if (++nodes > maxNodes) throw new CaptureFailure('limit-exceeded');
        if (node.nodeType === Node.TEXT_NODE) textUnits += node.textContent?.length ?? 0;
        if (textUnits > maxTextUnits) throw new CaptureFailure('limit-exceeded');
    }
}

function bounded<T>(promise: Promise<T>, signal?: AbortSignal, timeoutMs?: number): Promise<T> {
    throwIfAborted(signal);
    return new Promise((resolve, reject) => {
        let timer: ReturnType<typeof setTimeout> | undefined;
        const cleanup = () => { if (timer !== undefined) clearTimeout(timer); signal?.removeEventListener('abort', cancel); };
        const cancel = () => { cleanup(); reject(new DOMException('Asset preparation cancelled.', 'AbortError')); };
        signal?.addEventListener('abort', cancel, { once: true });
        if (timeoutMs !== undefined) timer = setTimeout(() => { cleanup(); reject(new CaptureFailure('timeout')); }, timeoutMs);
        promise.then(value => { cleanup(); resolve(value); }, error => { cleanup(); reject(error); });
    });
}

export function disposeRichContentAssets(): void {
    lifetimeGeneration += 1;
    if (expiryTimer !== null) clearTimeout(expiryTimer);
    expiryTimer = null;
    for (const task of inFlight.values()) { task.controller.abort(); releaseKeyReservation(task); }
    inFlight.clear();
    for (const entry of cache.values()) for (const asset of entry.assets) URL.revokeObjectURL(asset.objectUrl);
    cache.clear();
    cacheBytes = 0;
    pendingKeyBytes = 0;
    captureQueue = Promise.resolve();
}

export function __resetRichContentAssetsForTests(): void {
    disposeRichContentAssets();
}

registerRichContentAssetDisposer(disposeRichContentAssets);
