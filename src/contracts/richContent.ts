import type { SemanticSourceSpanV1 } from './semanticContent';

export type RichBlockKindV1 = 'svg' | 'image' | 'canvas' | 'html' | 'embed' | 'unknown';

export type RichBlockSourceV1 =
    | Readonly<{ kind: 'svg'; svg: string; width?: number; height?: number }>
    | Readonly<{ kind: 'loaded-image'; url: string; width?: number; height?: number }>
    | Readonly<{ kind: 'dom-capture'; surface: 'canvas' | 'html' | 'iframe' }>
    | Readonly<{
        kind: 'unavailable';
        reason: 'not-rendered' | 'cross-origin' | 'unsafe-resource' | 'unsupported';
    }>;

/** Resource descriptions are portable; DOM handles and captured bitmap bytes stay outside the content pool. */
export type RichBlockV1 = Readonly<{
    id: string;
    kind: RichBlockKindV1;
    label: string;
    fallbackMarkdown: string;
    visualDigest: string;
    source: RichBlockSourceV1;
}>;

export type RichContentReplacementV1 = Readonly<{ id: string; markdown: string }>;
export type RichContentBindingV1 = Readonly<{ id: string; span: SemanticSourceSpanV1 }>;
export type RichContentImageV1 = Readonly<{
    blockId: string;
    url: string;
    mimeType: 'image/svg+xml' | 'image/png' | 'image/jpeg' | 'image/webp';
}>;

const RICH_CONTENT_PREFIX = 'aimd-rich:';
const BLOCK_ID_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,255}$/;

export function getRichBlockIdFromUrl(url: string): string | null {
    if (!url.startsWith(RICH_CONTENT_PREFIX)) return null;
    const id = url.slice(RICH_CONTENT_PREFIX.length);
    return BLOCK_ID_RE.test(id) ? id : null;
}

export function isRichContentUrl(url: string): boolean {
    return getRichBlockIdFromUrl(url) !== null;
}

export function createRichContentUrl(id: string): string {
    if (!BLOCK_ID_RE.test(id)) throw new Error('Invalid rich content block identity.');
    return `${RICH_CONTENT_PREFIX}${id}`;
}

export function freezeRichBlocks(blocks: readonly RichBlockV1[]): readonly RichBlockV1[] {
    return Object.freeze(blocks.map(block => {
        const source = block.source;
        const dimensions = (source.kind === 'svg' || source.kind === 'loaded-image')
            ? { ...(source.width !== undefined ? { width: source.width } : {}), ...(source.height !== undefined ? { height: source.height } : {}) }
            : {};
        const copiedSource: RichBlockSourceV1 = source.kind === 'svg'
            ? { kind: 'svg', svg: source.svg, ...dimensions }
            : source.kind === 'loaded-image'
            ? { kind: 'loaded-image', url: source.url, ...dimensions }
            : source.kind === 'dom-capture'
            ? { kind: 'dom-capture', surface: source.surface }
            : { kind: 'unavailable', reason: source.reason };
        return Object.freeze({
            id: block.id,
            kind: block.kind,
            label: block.label,
            fallbackMarkdown: block.fallbackMarkdown,
            visualDigest: block.visualDigest,
            source: Object.freeze(copiedSource),
        });
    }));
}

export function isRichBlockV1(value: unknown): value is RichBlockV1 {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
    const block = value as Record<string, unknown>;
    if (
        typeof block.id !== 'string' || !BLOCK_ID_RE.test(block.id)
        || !['svg', 'image', 'canvas', 'html', 'embed', 'unknown'].includes(String(block.kind))
        || typeof block.label !== 'string' || block.label.length > 512
        || typeof block.fallbackMarkdown !== 'string' || block.fallbackMarkdown.length > 32_768
        || typeof block.visualDigest !== 'string' || !/^[A-Za-z0-9._-]{1,256}$/.test(block.visualDigest)
        || !block.source || typeof block.source !== 'object' || Array.isArray(block.source)
    ) return false;
    const source = block.source as Record<string, unknown>;
    for (const dimension of [source.width, source.height]) {
        if (dimension !== undefined && (typeof dimension !== 'number' || !Number.isFinite(dimension) || dimension <= 0 || dimension > 16_384)) return false;
    }
    switch (source.kind) {
        case 'svg': return typeof source.svg === 'string' && source.svg.length > 0 && source.svg.length <= 262_144;
        case 'loaded-image': return typeof source.url === 'string' && source.url.length > 0 && source.url.length <= 262_144;
        case 'dom-capture': return ['canvas', 'html', 'iframe'].includes(String(source.surface));
        case 'unavailable': return ['not-rendered', 'cross-origin', 'unsafe-resource', 'unsupported'].includes(String(source.reason));
        default: return false;
    }
}

export function isRichBlocksV1(value: unknown): value is readonly RichBlockV1[] {
    return Array.isArray(value) && value.length <= 128 && value.every(isRichBlockV1)
        && new Set(value.map(block => block.id)).size === value.length
        && value.reduce((sum, block) => sum + block.label.length + block.fallbackMarkdown.length
            + (block.source.kind === 'svg' ? block.source.svg.length : block.source.kind === 'loaded-image' ? block.source.url.length : 0), 0) <= 512 * 1024;
}
