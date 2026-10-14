import type {
    ConversationBodyV2,
    ConversationTurnIdentityV2,
    RenderedContentCompilePolicyV2,
    RenderedContentCompilerV2 as RenderedContentCompilerV2Port,
    RenderedParserCapabilityV2,
    RenderedTurnCompileRequestV2,
    RenderedTurnCompileResultV2,
} from '../../contracts/conversationDiscoveryV2';
import type { MarkdownParserAdapter } from '../../drivers/content/adapters/parser/MarkdownParserAdapter';
import type { RichBlockV1 } from '../../contracts/richContent';
import { compileRenderedBody } from './compileRenderedBody';

export type RenderedContentCompilerOptionsV2 = Readonly<{
    markdownParserAdapter: MarkdownParserAdapter;
    normalizeDOM?: (root: HTMLElement) => void;
    isNoiseNode?: (node: Node, context: { nextSibling: Element | null }) => boolean;
    getArtifactPlaceholder?: (node: HTMLElement) => string | null;
    cleanMarkdown?: (markdown: string) => string;
    collectRichBlocks?: (root: HTMLElement) => readonly RichBlockV1[];
}>;

export const DEFAULT_RENDERED_CONTENT_POLICY_V2: RenderedContentCompilePolicyV2 = Object.freeze({
    maxNodes: 50_000,
    maxInputCodeUnits: 4_000_000,
    maxOutputCodeUnits: 4_000_000,
    maxFormulaCodeUnits: 10_000,
    maxSliceMs: 8,
    maxWallTimeMs: 2_000,
});

/**
 * Best-effort DOM-to-Markdown compiler.
 *
 * Readiness is established by the host monitor before this seam. The compiler
 * therefore clones, normalizes and converts each root once, with only basic
 * size/time budgets. A local formula or code irregularity must not reject an
 * otherwise readable assistant message.
 */
export class RenderedContentCompilerV2 implements RenderedContentCompilerV2Port {
    constructor(private readonly options: RenderedContentCompilerOptionsV2) {}

    async compile(request: RenderedTurnCompileRequestV2): Promise<RenderedTurnCompileResultV2> {
        const startedAt = performance.now();
        try {
            const capabilities = { ...this.options, parserAdapter: this.options.markdownParserAdapter };
            const policy = {
                whitespace: 'formatting' as const,
                noiseErrors: 'reject' as const,
                maxInputCodeUnits: request.policy.maxInputCodeUnits,
                parserOptions: {
                    maxNodeCount: request.policy.maxNodes,
                    maxProcessingTimeMs: request.policy.maxWallTimeMs,
                    enablePerformanceLogging: false,
                },
            };
            const user = compileRenderedBody(request.userRootClone, capabilities, policy);
            const assistant = compileRenderedBody(request.assistantRootClone, capabilities, policy);
            if (user.kind !== 'ready' || assistant.kind !== 'ready') return { kind: 'rejected', reason: 'budget-exceeded' };
            if (!assistant.text && !assistant.richBlocks.length) return { kind: 'rejected', reason: 'empty-content' };

            const userMarkdown = user.markdown || user.text || '';
            const assistantMarkdown = assistant.markdown || assistant.text;
            if (
                userMarkdown.length > request.policy.maxOutputCodeUnits
                || assistantMarkdown.length > request.policy.maxOutputCodeUnits
                || performance.now() - startedAt > request.policy.maxWallTimeMs
            ) {
                return { kind: 'rejected', reason: 'budget-exceeded' };
            }

            const userBody = createBody(userMarkdown, user.text);
            const assistantBody = createBody(assistantMarkdown, assistant.text);
            const manifest = Object.freeze({
                nodeCount: user.nodeCount + assistant.nodeCount,
                formulaCount: 0,
                codeBlockCount: 0,
                tableCount: 0,
                imageCount: assistant.richBlocks.length,
            });
            return Object.freeze({
                kind: 'ready',
                user: userBody,
                assistant: assistantBody,
                assistantSourceMarkdown: assistant.sourceMarkdown || assistant.text,
                ...(assistant.richBlocks.length ? { assistantRichBlocks: assistant.richBlocks } : {}),
                semanticDigest: digest({
                    identity: request.identity,
                    user: userBody.markdown,
                    assistant: assistantBody.markdown,
                }),
                surfaceDigest: digest({
                    userSurfaceToken: request.userSurfaceToken,
                    assistantSurfaceToken: request.assistantSurfaceToken,
                }),
                manifest,
            });
        } catch {
            return { kind: 'rejected', reason: 'compiler-error' };
        }
    }

}

function createBody(markdown: string, text: string): ConversationBodyV2 {
    return Object.freeze({ markdown, text });
}

function digest(value: unknown): string {
    const input = JSON.stringify(value);
    let hashValue = 2166136261;
    for (let index = 0; index < input.length; index += 1) {
        hashValue ^= input.charCodeAt(index);
        hashValue = Math.imul(hashValue, 16777619);
    }
    return (hashValue >>> 0).toString(16).padStart(8, '0');
}

export function createRenderedParserCapabilityV2(
    parserAdapter: MarkdownParserAdapter,
): RenderedParserCapabilityV2 {
    const extended = parserAdapter as MarkdownParserAdapter & {
        extractCodeBlockText?: (block: HTMLElement) => string | null;
    };
    return Object.freeze({
        isFormula: (element: Element) => parserAdapter.isMathNode(element),
        readFormula: (element: HTMLElement) => {
            const result = parserAdapter.extractLatex(element);
            return result
                ? Object.freeze({ latex: result.latex, display: result.isBlock })
                : null;
        },
        isCodeBlock: (element: Element) => parserAdapter.isCodeBlockNode(element),
        readCodeBlock: (element: HTMLElement) => {
            const source = extended.extractCodeBlockText?.(element)
                ?? (element.querySelector('code')?.textContent ?? '');
            if (!source.trim()) return null;
            return Object.freeze({
                source,
                language: parserAdapter.getCodeLanguage(element) || null,
            });
        },
    });
}

export function createIdentityV2(
    turnId: string | null,
    userMessageId: string | null,
    assistantMessageId: string | null,
): ConversationTurnIdentityV2 | null {
    const normalizedTurn = turnId?.trim();
    const normalizedUser = userMessageId?.trim();
    const normalizedAssistant = assistantMessageId?.trim();
    if (!normalizedTurn || !normalizedUser || !normalizedAssistant) return null;
    return Object.freeze({
        turnId: normalizedTurn,
        userMessageId: normalizedUser,
        assistantMessageId: normalizedAssistant,
    });
}
