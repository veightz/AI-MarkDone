import { logger } from '../../core/logger';
import type { ParserOptions } from '../markdown-parser/core/types';
import type { MarkdownParserAdapter } from '../../drivers/content/adapters/parser/MarkdownParserAdapter';
import type { RichBlockV1 } from '../../contracts/richContent';
import { compileRenderedBody } from './compileRenderedBody';

export type RenderedContentCompilerCapabilities = Readonly<{
    parserAdapter: MarkdownParserAdapter | null;
    normalizeDOM?: (root: HTMLElement) => void;
    isNoiseNode?: (node: Node, context: { nextSibling: Element | null }) => boolean;
    getArtifactPlaceholder?: (node: HTMLElement) => string | null;
    enhanceUnrenderedMath?: boolean;
    cleanMarkdown?: (markdown: string) => string;
    collectRichBlocks?: (root: HTMLElement) => readonly RichBlockV1[];
}>;

export type RenderedContentCompileResult =
    | Readonly<{ kind: 'ready'; markdown: string; sourceMarkdown?: string; richBlocks?: readonly RichBlockV1[] }>
    | Readonly<{
        kind: 'rejected';
        reason: 'unsupported-parser' | 'empty-content' | 'parser-budget' | 'compile-error';
        message: string;
    }>;

/**
 * Provider-neutral rendered-content compiler.
 *
 * The compiler understands only DOM semantics and injected parser
 * capabilities. Platform selectors, lifecycle identity and host ownership
 * stay in the adapter that supplies the root and capabilities.
 */
export class RenderedContentCompiler {
    constructor(private readonly capabilities: RenderedContentCompilerCapabilities) {}

    compile(root: HTMLElement, options: ParserOptions = {}): RenderedContentCompileResult {
        const parserAdapter = this.capabilities.parserAdapter;
        if (!parserAdapter) {
            return {
                kind: 'rejected',
                reason: 'unsupported-parser',
                message: 'No rendered-content parser capability is available.',
            };
        }

        try {
            const clone = root.cloneNode(true) as HTMLElement;
            const result = compileRenderedBody(clone, { ...this.capabilities, parserAdapter }, {
                whitespace: 'rendered', noiseErrors: 'ignore', parserOptions: options,
            });
            if (result.kind === 'rejected') {
                return {
                    kind: 'rejected',
                    reason: 'parser-budget',
                    message: 'Markdown fragment budget exceeded.',
                };
            }
            const normalized = result.markdown;
            if (!normalized) {
                return {
                    kind: 'rejected',
                    reason: 'empty-content',
                    message: 'Rendered content did not contain a complete semantic body.',
                };
            }
            return Object.freeze({
                kind: 'ready', markdown: normalized,
                ...(result.sourceMarkdown !== normalized ? { sourceMarkdown: result.sourceMarkdown } : {}),
                ...(result.richBlocks.length ? { richBlocks: result.richBlocks } : {}),
            });
        } catch (error) {
            logger.warn('[AI-MarkDone][RenderedContentCompiler] Compile failed', error);
            return {
                kind: 'rejected',
                reason: 'compile-error',
                message: error instanceof Error ? error.message : 'Rendered content compilation failed.',
            };
        }
    }
}
