import { describe, expect, it } from 'vitest';
import { chatgptMarkdownParserAdapter } from '@/drivers/content/adapters/parser/chatgpt';
import { normalizeChatGPTReaderMarkdown } from '@/core/content/chatgptMarkdownCleanup';
import { ChatGPTAdapter } from '@/drivers/content/adapters/sites/chatgpt';
import { RenderedContentCompiler } from '@/services/content/RenderedContentCompiler';
import { readFileSync } from 'node:fs';
import {
    createRenderedParserCapabilityV2,
    RenderedContentCompilerV2,
} from '@/services/content/RenderedContentCompilerV2';

function createCompiler() {
    return new RenderedContentCompilerV2({
        markdownParserAdapter: chatgptMarkdownParserAdapter,
        isNoiseNode: (node) => node instanceof HTMLElement && node.matches('button, [aria-hidden="true"]'),
    });
}

function request(userHtml: string, assistantHtml: string) {
    const user = document.createElement('div');
    const assistant = document.createElement('div');
    user.innerHTML = userHtml;
    assistant.innerHTML = assistantHtml;
    return {
        identity: { turnId: 'turn-1', userMessageId: 'user-1', assistantMessageId: 'assistant-1' },
        userRootClone: user,
        assistantRootClone: assistant,
        userSurfaceToken: 'surface-user',
        assistantSurfaceToken: 'surface-assistant',
        parser: createRenderedParserCapabilityV2(chatgptMarkdownParserAdapter),
        policy: {
            maxNodes: 50_000,
            maxInputCodeUnits: 4_000_000,
            maxOutputCodeUnits: 4_000_000,
            maxFormulaCodeUnits: 10_000,
            maxSliceMs: 8,
            maxWallTimeMs: 2_000,
        },
    } as const;
}

describe('RenderedContentCompilerV2', () => {
    it('compiles semantic structure and removes UI chrome', async () => {
        const result = await createCompiler().compile(request(
            '<p>Hello <strong>world</strong></p><button>copy</button>',
            '<h2>Answer</h2><ul><li>One</li><li>Two</li></ul>',
        ));

        expect(result.kind).toBe('ready');
        if (result.kind !== 'ready') return;
        expect(result.user.markdown).toContain('**world**');
        expect(result.user.markdown).not.toContain('copy');
        expect(result.assistant.markdown).toContain('- One');
        expect(result.manifest.nodeCount).toBeGreaterThan(0);
    });

    it('retains parsed source links alongside the legacy cleaned body', async () => {
        const compiler = new RenderedContentCompilerV2({
            markdownParserAdapter: chatgptMarkdownParserAdapter,
            cleanMarkdown: normalizeChatGPTReaderMarkdown,
        });
        const result = await compiler.compile(request('<p>Question</p>', '<p>Read <a href="https://example.com">paper</a>.</p>'));
        expect(result.kind).toBe('ready');
        if (result.kind !== 'ready') return;
        expect(result.assistant.markdown).toBe('Read paper.');
        expect(result.assistantSourceMarkdown).toContain('[paper](https://example.com)');
    });

    it('uses formula source when available without rejecting the whole message when it is absent', async () => {
        const ready = await createCompiler().compile(request(
            '<p>Question</p>',
            '<p>Value <span class="katex" data-math-source="x^2">x²</span></p>',
        ));
        expect(ready.kind).toBe('ready');
        if (ready.kind === 'ready') {
            expect(ready.assistant.markdown).toContain('x^2');
        }

        const bestEffort = await createCompiler().compile(request(
            '<p>Question</p>',
            '<p><span class="katex">x²</span></p>',
        ));
        expect(bestEffort.kind).toBe('ready');
    });

    it('ignores formatting-only whitespace between rendered block nodes', async () => {
        const result = await createCompiler().compile(request(
            '<p>Question</p>',
            `
                <h1>Answer</h1>
                <p><strong>Before <span class="katex" data-math-source="\\frac{x}{y}">x/y</span> after.</strong></p>
            `,
        ));

        expect(result.kind).toBe('ready');
        if (result.kind !== 'ready') return;
        expect(result.assistant.markdown).toBe('# Answer\n\n**Before $\\frac{x}{y}$ after.**');
    });

    it('rejects oversized input before publishing any Markdown', async () => {
        const result = await createCompiler().compile({
            ...request('<p>Question</p>', '<p>Answer</p>'),
            policy: {
                maxNodes: 50_000,
                maxInputCodeUnits: 2,
                maxOutputCodeUnits: 4_000_000,
                maxFormulaCodeUnits: 10_000,
                maxSliceMs: 8,
                maxWallTimeMs: 2_000,
            },
        });
        expect(result).toEqual({ kind: 'rejected', reason: 'budget-exceeded' });
    });

    it('does not add a second full-body semantic comparison after adapter conversion', async () => {
        const compiler = new RenderedContentCompilerV2({
            markdownParserAdapter: chatgptMarkdownParserAdapter,
            cleanMarkdown: () => 'unrelated output',
        });
        const result = await compiler.compile(request(
            '<p>Question with a stable identity</p>',
            '<p>Answer with a stable body</p>',
        ));
        expect(result.kind).toBe('ready');
    });

    it('accepts an assistant body when the previous user prompt is not mounted', async () => {
        const result = await createCompiler().compile(request('', '<p>Answer</p>'));

        expect(result.kind).toBe('ready');
        if (result.kind !== 'ready') return;
        expect(result.user).toEqual({ markdown: '', text: '' });
        expect(result.assistant.markdown).toBe('Answer');
    });

    it('uses the same body conversion and rich sidecar for current-message and pool captures', async () => {
        const adapter = new ChatGPTAdapter();
        const root = document.createElement('div');
        root.innerHTML = readFileSync('tests/testdata/chatgpt/rich-content.html', 'utf8');
        const capabilities = {
            normalizeDOM: (clone: HTMLElement) => adapter.normalizeDOM(clone),
            isNoiseNode: adapter.isNoiseNode.bind(adapter),
            cleanMarkdown: adapter.cleanMarkdown.bind(adapter),
            collectRichBlocks: adapter.collectRichBlocks.bind(adapter),
        };
        const current = new RenderedContentCompiler({ parserAdapter: chatgptMarkdownParserAdapter, ...capabilities }).compile(root);
        const pooled = await new RenderedContentCompilerV2({ markdownParserAdapter: chatgptMarkdownParserAdapter, ...capabilities })
            .compile({ ...request('', ''), assistantRootClone: root.cloneNode(true) as HTMLElement });
        expect(current.kind).toBe('ready');
        expect(pooled.kind).toBe('ready');
        if (current.kind !== 'ready' || pooled.kind !== 'ready') return;
        expect(pooled.assistant.markdown).toBe(current.markdown);
        expect(pooled.assistantRichBlocks).toEqual(current.richBlocks);
        expect(pooled.assistantSourceMarkdown).toBe(current.sourceMarkdown ?? current.markdown);
    });

    it('admits a path-only assistant SVG without requiring readable text or a user prompt', async () => {
        const adapter = new ChatGPTAdapter();
        const result = await new RenderedContentCompilerV2({
            markdownParserAdapter: chatgptMarkdownParserAdapter,
            collectRichBlocks: adapter.collectRichBlocks.bind(adapter),
            cleanMarkdown: adapter.cleanMarkdown.bind(adapter),
        }).compile(request('', '<svg viewBox="0 0 10 10"><path d="M0 0L10 10"/></svg>'));
        expect(result.kind).toBe('ready');
        if (result.kind !== 'ready') return;
        expect(result.user).toEqual({ text: '', markdown: '' });
        expect(result.assistant.markdown).toContain('aimd-rich:');
        expect(result.assistantRichBlocks).toHaveLength(1);
    });
});
