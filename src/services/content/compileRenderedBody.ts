import type { RichBlockV1 } from '../../contracts/richContent';
import type { MarkdownParserAdapter } from '../../drivers/content/adapters/parser/MarkdownParserAdapter';
import { logger } from '../../core/logger';
import { enhanceUnrenderedMath } from '../copy/preprocess/math-extractor';
import { createMarkdownParser } from '../markdown-parser/createMarkdownParser';
import type { ParserOptions } from '../markdown-parser/core/types';

export type RenderedBodyCapabilities = Readonly<{
    parserAdapter: MarkdownParserAdapter;
    normalizeDOM?: (root: HTMLElement) => void;
    isNoiseNode?: (node: Node, context: { nextSibling: Element | null }) => boolean;
    getArtifactPlaceholder?: (node: HTMLElement) => string | null;
    collectRichBlocks?: (root: HTMLElement) => readonly RichBlockV1[];
    enhanceUnrenderedMath?: boolean;
    cleanMarkdown?: (markdown: string) => string;
}>;

export type RenderedBodyPolicy = Readonly<{
    whitespace: 'rendered' | 'formatting';
    noiseErrors: 'ignore' | 'reject';
    parserOptions?: ParserOptions;
    maxInputCodeUnits?: number;
}>;

export type RenderedBodyResult =
    | Readonly<{
        kind: 'ready';
        markdown: string;
        sourceMarkdown: string;
        text: string;
        nodeCount: number;
        richBlocks: readonly RichBlockV1[];
    }>
    | Readonly<{ kind: 'rejected'; reason: 'input-budget' | 'parser-budget' }>;

/** The caller owns this clone. Single-message and pool wrappers share conversion without cloning it twice. */
export function compileRenderedBody(
    clone: HTMLElement,
    capabilities: RenderedBodyCapabilities,
    policy: RenderedBodyPolicy,
): RenderedBodyResult {
    const richBlocks = capabilities.collectRichBlocks?.(clone) ?? Object.freeze([]);
    capabilities.normalizeDOM?.(clone);
    removeNoiseNodes(clone, capabilities, policy.noiseErrors);
    normalizeWhitespace(clone, policy.whitespace);
    if (capabilities.enhanceUnrenderedMath) enhanceUnrenderedMath(clone);
    const nodeCount = clone.querySelectorAll('*').length + 1;
    const text = (clone.textContent ?? '').replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
    if (policy.maxInputCodeUnits !== undefined && text.length > policy.maxInputCodeUnits) {
        return { kind: 'rejected', reason: 'input-budget' };
    }
    const sourceMarkdown = createMarkdownParser(capabilities.parserAdapter, {
        enablePerformanceLogging: false,
        ...policy.parserOptions,
    }).parse(clone).trim();
    if (/^<!-- Parser (?:Max nodes|Time budget)/.test(sourceMarkdown)) {
        return { kind: 'rejected', reason: 'parser-budget' };
    }
    const markdown = (capabilities.cleanMarkdown?.(sourceMarkdown) ?? sourceMarkdown).trim();
    return Object.freeze({ kind: 'ready', markdown, sourceMarkdown, text, nodeCount, richBlocks });
}

function removeNoiseNodes(root: HTMLElement, capabilities: RenderedBodyCapabilities, errors: 'ignore' | 'reject'): void {
    if (!capabilities.isNoiseNode) return;
    const removed: Array<{ element: HTMLElement; placeholder: string | null }> = [];
    for (const element of Array.from(root.querySelectorAll<HTMLElement>('*'))) {
        try {
            if (capabilities.isNoiseNode(element, { nextSibling: element.nextElementSibling })) {
                removed.push({ element, placeholder: capabilities.getArtifactPlaceholder?.(element) ?? null });
            }
        } catch (error) {
            if (errors === 'reject') throw error;
            logger.warn('[AI-MarkDone][RenderedContentCompiler] Noise policy failed', error);
        }
    }
    for (const { element, placeholder } of removed.reverse()) {
        if (!element.parentNode) continue;
        if (!placeholder) element.remove();
        else {
            const replacement = root.ownerDocument.createElement('p');
            replacement.textContent = placeholder;
            element.replaceWith(replacement);
        }
    }
}

function normalizeWhitespace(root: HTMLElement, policy: 'rendered' | 'formatting'): void {
    const walker = root.ownerDocument.createTreeWalker(root, 4);
    const texts: Text[] = [];
    let current: Node | null;
    while ((current = walker.nextNode())) texts.push(current as Text);
    for (const text of texts) {
        if (text.parentElement?.closest('pre, code, textarea, .katex, .katex-display, math')) continue;
        const normalized = text.data.replace(/\u00a0/g, ' ');
        if (!normalized.trim()) {
            if (policy === 'formatting' && !/[\r\n]/.test(normalized)) continue;
            if (text.previousSibling && text.nextSibling && !isBlock(text.previousSibling) && !isBlock(text.nextSibling)) text.data = ' ';
            else text.remove();
        } else if (policy === 'rendered') text.data = normalized.replace(/\s+/g, ' ');
    }
}

function isBlock(node: Node): boolean {
    return node.nodeType === 1 && (node as Element).matches(
        'address, article, aside, div, dl, fieldset, figure, footer, form, h1, h2, h3, h4, h5, h6, header, hr, li, main, nav, ol, p, pre, section, table, ul',
    );
}
