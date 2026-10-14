export type LightweightSvgResult =
    | Readonly<{ kind: 'ready'; svg: string; width?: number; height?: number }>
    | Readonly<{ kind: 'unavailable'; reason: 'unsafe-resource' | 'unsupported' }>;

const MAX_SOURCE_UNITS = 262_144;
const MAX_NODES = 2_000;
const MAX_DIMENSION = 16_384;
const SVG_NAMESPACE = 'http://www.w3.org/2000/svg';
const ALLOWED_ELEMENTS = new Set([
    'svg', 'g', 'defs', 'path', 'rect', 'circle', 'ellipse', 'line', 'polyline', 'polygon',
    'text', 'tspan', 'textpath', 'title', 'desc', 'use', 'symbol', 'clippath', 'mask',
    'lineargradient', 'radialgradient', 'stop', 'pattern', 'marker', 'style', 'filter',
    'fegaussianblur', 'feoffset', 'femerge', 'femergenode', 'fecolormatrix', 'feblend',
    'fecomposite', 'feflood', 'fedropshadow',
]);
const LOCAL_PAINT_PROPERTIES = new Set(['color', 'fill', 'stroke', 'stop-color', 'flood-color', 'lighting-color']);
const INHERITED_PAINT_PROPERTIES = ['fill', 'stroke'] as const;
const DEPENDENT_COLOR_NAMES = new Set([
    'currentcolor', 'inherit', 'initial', 'unset', 'revert', 'accentcolor', 'accentcolortext',
    'activetext', 'buttonborder', 'buttonface', 'buttontext', 'canvas', 'canvastext', 'field',
    'fieldtext', 'graytext', 'highlight', 'highlighttext', 'linktext', 'mark', 'marktext',
    'selecteditem', 'selecteditemtext', 'visitedtext', 'activeborder', 'activecaption',
    'appworkspace', 'background', 'buttonhighlight', 'buttonshadow', 'captiontext',
    'inactiveborder', 'inactivecaption', 'inactivecaptiontext', 'infobackground', 'infotext',
    'menu', 'menutext', 'scrollbar', 'threeddarkshadow', 'threedface', 'threedhighlight',
    'threedlightshadow', 'threedshadow', 'window', 'windowframe', 'windowtext',
]);

function hasUnsafeCss(value: string): boolean {
    if (/[\\]|@|expression\s*\(|javascript\s*:|behavior\s*:|-moz-binding|image-set\s*\(|(?:https?|data|blob|file)\s*:/i.test(value)) return true;
    for (const match of value.matchAll(/url\s*\(([^)]*)\)/gi)) {
        if (!/^["']?#[A-Za-z_][\w:.-]*["']?$/.test(match[1].trim())) return true;
    }
    return false;
}

function readDimension(value: string | null): number | undefined {
    if (!value || !/^\s*(?:\d+\.?\d*|\.\d+)(?:px)?\s*$/.test(value)) return undefined;
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

function explicitColor(value: string): string | null {
    const candidate = value.trim().toLowerCase();
    if (!candidate || candidate.length > 128 || DEPENDENT_COLOR_NAMES.has(candidate) || hasUnsafeCss(candidate)) return null;
    if (!/^(?:#[\da-f]{3,8}|[a-z]+|(?:rgba?|hsla?)\([\d\s.,%+/-]*(?:deg|grad|rad|turn)?[\d\s.,%+/-]*\))$/i.test(candidate)) return null;
    const probe = document.createElement('span').style;
    probe.color = candidate;
    return probe.color || null;
}

function closeLocalCurrentColor(root: Element, elements: readonly Element[]): boolean {
    const usesCurrentColor = elements.some(element => Array.from(element.attributes).some(attribute => /\bcurrentcolor\b/i.test(attribute.value))
        || (element.localName.toLowerCase() === 'style' && /\bcurrentcolor\b/i.test(element.textContent ?? '')));
    if (!usesCurrentColor) return true;
    // Stylesheet cascade and host classes cannot be proven from an isolated SVG source.
    if (root.querySelector('style') || elements.some(element => element.hasAttribute('class'))) return false;
    const colors = new Map<Element, string | null>();
    const inheritedCurrentPaint = new Map<Element, ReadonlySet<string>>();
    for (const element of elements) {
        const style = document.createElement('span').style;
        style.cssText = element.getAttribute('style') ?? '';
        const parentColor = element.parentElement ? colors.get(element.parentElement) ?? null : null;
        const declaredColor = style.getPropertyValue('color') || element.getAttribute('color') || '';
        const color = !declaredColor || /^(?:currentcolor|inherit|unset)$/i.test(declaredColor.trim())
            ? parentColor : explicitColor(declaredColor);
        colors.set(element, color);
        const inherited = element.parentElement ? inheritedCurrentPaint.get(element.parentElement) ?? new Set<string>() : new Set<string>();
        if (parentColor !== color && inherited.size > 0) {
            for (const property of inherited) {
                const ownPaint = style.getPropertyValue(property) || element.getAttribute(property);
                if (!ownPaint || /^(?:inherit|unset)$/i.test(ownPaint.trim())) return false;
            }
        }
        const active = new Set(inherited);
        for (const property of INHERITED_PAINT_PROPERTIES) {
            const paint = style.getPropertyValue(property) || element.getAttribute(property);
            if (/^currentcolor$/i.test(paint?.trim() ?? '')) active.add(property);
            else if (paint && !/^(?:inherit|unset)$/i.test(paint.trim())) active.delete(property);
        }
        inheritedCurrentPaint.set(element, active);
        for (const attribute of Array.from(element.attributes)) {
            if (attribute.name === 'style' || !/\bcurrentcolor\b/i.test(attribute.value)) continue;
            if (!color || !LOCAL_PAINT_PROPERTIES.has(attribute.localName.toLowerCase()) || !/^currentcolor$/i.test(attribute.value.trim())) return false;
            element.setAttribute(attribute.name, color);
        }
        for (const property of Array.from(style)) {
            const value = style.getPropertyValue(property);
            if (!/\bcurrentcolor\b/i.test(value)) continue;
            if (!color || !LOCAL_PAINT_PROPERTIES.has(property) || !/^currentcolor$/i.test(value.trim())) return false;
            style.setProperty(property, color, style.getPropertyPriority(property));
        }
        if (/\bcurrentcolor\b/i.test(element.getAttribute('style') ?? '')) {
            if (/\bcurrentcolor\b/i.test(style.cssText)) return false;
            element.setAttribute('style', style.cssText);
        }
    }
    return true;
}

/** Only self-contained SVG is admitted; HTML labels or active/external content require a separate bitmap capture. */
export function sanitizeLightweightSvg(source: string | SVGElement): LightweightSvgResult {
    const input = typeof source === 'string' ? source : source.outerHTML;
    if (!input || input.length > MAX_SOURCE_UNITS || /<!\s*(?:DOCTYPE|ENTITY)|<\?(?!xml(?:\s|\?>))/i.test(input)) {
        return { kind: 'unavailable', reason: 'unsafe-resource' };
    }
    const parsed = new DOMParser().parseFromString(input, 'image/svg+xml');
    const root = parsed.documentElement;
    if (root.localName.toLowerCase() !== 'svg' || parsed.querySelector('parsererror')) {
        return { kind: 'unavailable', reason: 'unsupported' };
    }
    const elements = [root, ...Array.from(root.querySelectorAll('*'))];
    if (elements.length > MAX_NODES) return { kind: 'unavailable', reason: 'unsafe-resource' };
    for (const element of elements) {
        const tag = element.localName.toLowerCase();
        if (tag === 'foreignobject') return { kind: 'unavailable', reason: 'unsupported' };
        if (!ALLOWED_ELEMENTS.has(tag) || (element.namespaceURI && element.namespaceURI !== SVG_NAMESPACE)) {
            return { kind: 'unavailable', reason: 'unsafe-resource' };
        }
        for (const attribute of Array.from(element.attributes)) {
            const name = attribute.localName.toLowerCase();
            const value = attribute.value.trim();
            if (/^on/i.test(name) || ['src', 'srcset'].includes(name)) {
                return { kind: 'unavailable', reason: 'unsafe-resource' };
            }
            if (name === 'href' && value && !/^#[A-Za-z_][\w:.-]*$/.test(value)) {
                return { kind: 'unavailable', reason: 'unsafe-resource' };
            }
            // Namespace declarations are identities, not external paint resources.
            if (attribute.name !== 'xmlns' && !attribute.name.startsWith('xmlns:') && hasUnsafeCss(value)) {
                return { kind: 'unavailable', reason: 'unsafe-resource' };
            }
            if (/var\s*\(/i.test(value)) return { kind: 'unavailable', reason: 'unsupported' };
        }
        if (tag === 'style' && hasUnsafeCss(element.textContent ?? '')) {
            return { kind: 'unavailable', reason: 'unsafe-resource' };
        }
    }
    if (!root.querySelector('style') && elements.some(element => element.hasAttribute('class'))) {
        return { kind: 'unavailable', reason: 'unsupported' };
    }
    if (!closeLocalCurrentColor(root, elements)) return { kind: 'unavailable', reason: 'unsupported' };
    const viewBox = root.getAttribute('viewBox')?.trim().split(/[\s,]+/).map(Number);
    if (viewBox && (viewBox.length !== 4 || viewBox.some(value => !Number.isFinite(value)) || viewBox[2] <= 0 || viewBox[3] <= 0)) {
        return { kind: 'unavailable', reason: 'unsupported' };
    }
    const width = readDimension(root.getAttribute('width')) ?? viewBox?.[2];
    const height = readDimension(root.getAttribute('height')) ?? viewBox?.[3];
    for (const name of ['width', 'height']) {
        const value = root.getAttribute(name);
        if (value && readDimension(value) === undefined && !/^\s*(?:100|\d{1,2})(?:\.\d+)?%\s*$/.test(value)) {
            return { kind: 'unavailable', reason: 'unsupported' };
        }
    }
    if (
        (width !== undefined && width > MAX_DIMENSION)
        || (height !== undefined && height > MAX_DIMENSION)
        || (width !== undefined && height !== undefined && width * height > 64_000_000)
    ) return { kind: 'unavailable', reason: 'unsafe-resource' };
    root.setAttribute('xmlns', SVG_NAMESPACE);
    if (width !== undefined) root.setAttribute('width', String(width));
    if (height !== undefined) root.setAttribute('height', String(height));
    const svg = new XMLSerializer().serializeToString(root);
    if (svg.length > MAX_SOURCE_UNITS) return { kind: 'unavailable', reason: 'unsafe-resource' };
    return Object.freeze({ kind: 'ready', svg, ...(width ? { width } : {}), ...(height ? { height } : {}) });
}
