import { describe, expect, it } from 'vitest';
import { ChatGPTAdapter } from '@/drivers/content/adapters/sites/chatgpt';
import { copyMarkdownFromMessage } from '@/services/copy/copy-markdown';
import {
    collectChatGPTRichBlockSurfaces,
    normalizeChatGPTRichBlocks,
    sanitizeLightweightSvg,
} from '@/drivers/content/chatgpt/chatgptRichContent';
import { readFileSync } from 'node:fs';
import { isRichBlocksV1 } from '@/contracts/richContent';
import { renderMarkdownForReader } from '@/services/renderer/renderMarkdown';
import { projectRichContentMarkdown } from '@/services/content/richContentProjection';

function fixture(): HTMLElement {
    const root = document.createElement('div');
    root.innerHTML = readFileSync('tests/testdata/chatgpt/rich-content.html', 'utf8');
    return root;
}

describe('ChatGPT rich content capture boundary', () => {
    it('captures the observed paired numeric DIL row as one visual with both metric labels', () => {
        const root = document.createElement('div');
        root.innerHTML = readFileSync('tests/testdata/chatgpt/dil-paired-metrics.html', 'utf8');
        const surfaces = collectChatGPTRichBlockSurfaces(root);
        expect(surfaces).toHaveLength(1);
        expect(surfaces[0].element).toBe(root.querySelector('[data-d-component="row"]'));
        expect(surfaces[0].block.source).toEqual({ kind: 'dom-capture', surface: 'html' });
        expect(surfaces[0].block.fallbackMarkdown).toContain('0.977 Spearman 排序相关系数');
        expect(surfaces[0].block.fallbackMarkdown).toContain('0.021 成功概率平均绝对误差');
    });

    it('uses the same structural metric rule for three direct numeric columns', () => {
        const root = document.createElement('div');
        root.innerHTML = readFileSync('tests/testdata/chatgpt/dil-paired-metrics.html', 'utf8');
        const row = root.querySelector('[data-d-component="row"]')!;
        const third = row.firstElementChild!.cloneNode(true) as Element;
        third.querySelector('[data-d-component="title"]')!.textContent = '0.500';
        third.querySelector('[data-d-component="caption"]')!.textContent = 'Calibration score';
        row.append(third);
        const surfaces = collectChatGPTRichBlockSurfaces(root);
        expect(surfaces).toHaveLength(1);
        expect(surfaces[0].element).toBe(row);
        expect(surfaces[0].block.fallbackMarkdown).toContain('0.500 Calibration score');
        expect(surfaces[0].block.fallbackMarkdown).toContain('0.977 Spearman 排序相关系数');
        expect(surfaces[0].block.fallbackMarkdown).toContain('0.021 成功概率平均绝对误差');
    });

    it('keeps metric numbers out of the Reader outline and preserves their text through the shared copy projection', () => {
        const root = document.createElement('div');
        root.innerHTML = readFileSync('tests/testdata/chatgpt/dil-paired-metrics.html', 'utf8');
        const result = copyMarkdownFromMessage(new ChatGPTAdapter(), root.firstElementChild as HTMLElement);
        expect(result.ok).toBe(true);
        if (!result.ok) return;
        const rendered = renderMarkdownForReader(result.markdown, { richContent: { blocks: result.richBlocks ?? [] } });
        expect(rendered.outlineItems.map(item => item.text)).toEqual(['Surrogate accuracy']);
        expect(rendered.html).not.toContain('#0.021');
        expect(result.markdown).not.toMatch(/^#+\s*0\.(?:977|021)/m);
        const copied = projectRichContentMarkdown(result.markdown, result.richBlocks ?? []);
        expect(copied.status).toBe('ready');
        if (copied.status !== 'ready' || copied.kind !== 'rich-content') return;
        expect(copied.markdown).toContain('0.977 Spearman 排序相关系数');
        expect(copied.markdown).toContain('0.021 成功概率平均绝对误差');
    });

    it.each(['unmarked', 'prose-title', 'missing-caption', 'single-box'])(
        'does not classify an ordinary DIL row lacking paired metric evidence (%s)', variant => {
            const root = document.createElement('div');
            root.innerHTML = readFileSync('tests/testdata/chatgpt/dil-paired-metrics.html', 'utf8');
            if (variant === 'unmarked') root.querySelectorAll('[data-d-tabular-nums]').forEach(title => title.removeAttribute('data-d-tabular-nums'));
            if (variant === 'prose-title') root.querySelector('h1')!.textContent = 'Overview';
            if (variant === 'missing-caption') root.querySelector('[data-d-component="caption"]')!.remove();
            if (variant === 'single-box') root.querySelector('[data-d-component="box"]')!.remove();
            expect(collectChatGPTRichBlockSurfaces(root)).toHaveLength(0);
        },
    );
    it('keeps descriptor collections bounded and leaves readable limit placeholders', () => {
        const root = document.createElement('div');
        root.innerHTML = Array.from({ length: 130 }, (_, index) => `<svg viewBox="0 0 10 10"><title>Diagram ${index}</title><path d="M0 0L1 1"/></svg>`).join('');
        const blocks = normalizeChatGPTRichBlocks(root);
        expect(isRichBlocksV1(blocks)).toBe(true);
        expect(root.querySelector('svg')).toBeNull();
        expect(root.textContent).toContain('capture limit');
    });
    it('uses chart accessibility data and caption instead of concatenated axis ticks', () => {
        const root = document.createElement('div');
        root.innerHTML = '<div data-d-component="box"><p data-d-component="caption">Figure 4: Eve success</p><div data-testid="chatgpt-chart-content-reference" aria-label="Chart chart"><svg><text>0%15%30%45%60%</text></svg><ul class="sr-only"><li>20 dB: observed 51.3%</li></ul><button>Share</button></div></div>';
        const block = collectChatGPTRichBlockSurfaces(root)[0]!.block;
        expect(block.label).toBe('Figure 4: Eve success');
        expect(block.fallbackMarkdown).toContain('20 dB: observed 51.3%');
        expect(block.fallbackMarkdown).not.toContain('0%15%30%45%60%');
        expect(block.fallbackMarkdown).not.toContain('Share');
    });

    it('captures unbordered numeric DIL cards as a visual instead of article headings', () => {
        const root = document.createElement('div');
        root.innerHTML = '<h2>Section</h2><div data-d-component="box"><p data-d-component="caption">Risk summary</p><div data-d-component="grid"><div data-d-component="grid-item"><p>Prior</p><h2>16.1%</h2></div><div data-d-component="grid-item"><p>Observed</p><h2>51.3%</h2></div></div></div>';
        const blocks = normalizeChatGPTRichBlocks(root);
        expect(blocks).toHaveLength(1);
        expect(blocks[0]!.fallbackMarkdown).toContain('16.1%');
        expect(Array.from(root.querySelectorAll('h2')).map(node => node.textContent)).toEqual(['Section']);
    });

    it('classifies top-level visuals once without treating formula SVG or control icons as content', () => {
        const root = fixture();
        const original = root.innerHTML;
        const surfaces = collectChatGPTRichBlockSurfaces(root);
        expect(surfaces.map(({ block }) => block.kind)).toEqual(['svg', 'html', 'image', 'canvas', 'embed', 'unknown']);
        expect(root.innerHTML).toBe(original);
        expect(surfaces[1].block.source).toEqual({ kind: 'dom-capture', surface: 'html' });
        expect(surfaces[1].block.fallbackMarkdown).toContain('Alpha: 12; Beta: 7');
        expect(surfaces[0].block.source.kind).toBe('svg');
        expect(collectChatGPTRichBlockSurfaces(root.cloneNode(true) as HTMLElement).map(({ block }) => block))
            .toEqual(surfaces.map(({ block }) => block));
    });

    it('normalizes visual-only content into a canonical internal image plus a sidecar', () => {
        const root = document.createElement('div');
        root.innerHTML = '<svg viewBox="0 0 120 80"><path d="M0 0L20 20"/></svg>';
        const blocks = normalizeChatGPTRichBlocks(root);
        expect(blocks).toHaveLength(1);
        expect(root.querySelector('img')?.getAttribute('src')).toBe(`aimd-rich:${blocks[0].id}`);
        expect(root.querySelector('svg')).toBeNull();
    });

    it('preserves rich refs and sidecars through the actual current-message copy seam', () => {
        const root = document.createElement('div');
        root.innerHTML = '<div data-message-author-role="assistant" data-message-id="a"><div class="markdown prose"><p>Before.</p><svg viewBox="0 0 10 10"><path d="M0 0L10 10"/></svg><p>After.</p></div></div>';
        const result = copyMarkdownFromMessage(new ChatGPTAdapter(), root.firstElementChild as HTMLElement);
        expect(result.ok).toBe(true);
        if (!result.ok) return;
        expect(result.richBlocks).toHaveLength(1);
        expect(result.markdown).toMatch(/^Before\.\n\n!\[.*\]\(aimd-rich:[^)]+\)\n\nAfter\.$/);
    });

    it('gives different geometry different identities even when captions match', () => {
        const root = document.createElement('div');
        root.innerHTML = '<figure><figcaption>Same</figcaption><svg viewBox="0 0 10 10"><path d="M0 0L10 10"/></svg></figure>';
        const first = collectChatGPTRichBlockSurfaces(root)[0].block;
        root.querySelector('path')!.setAttribute('d', 'M0 10L10 0');
        const second = collectChatGPTRichBlockSurfaces(root)[0].block;
        expect(second.id).not.toBe(first.id);
        expect(second.visualDigest).not.toBe(first.visualDigest);
    });

    it('captures bordered DIL flows/cards as one visual and preserves normal semibold text/popover labels', () => {
        const root = document.createElement('div');
        root.innerHTML = `<div data-message-author-role="assistant" data-message-id="a"><div data-markdown-text-style="assistant-message">
          <p data-d-component="text">Ordinary <span data-d-weight="semibold">emphasis</span> and <span data-d-component="popover-trigger" role="link">a label</span>.</p>
          <div data-d-component="box" data-d-direction="col" data-d-has-border="true"><div data-d-component="grid"><div data-d-component="grid-item"><h1>97.7%</h1><p>Success</p></div></div></div>
        </div></div>`;
        const result = copyMarkdownFromMessage(new ChatGPTAdapter(), root.firstElementChild as HTMLElement);
        expect(result.ok).toBe(true);
        if (!result.ok) return;
        expect(result.markdown).toContain('Ordinary **emphasis** and a label.');
        expect(result.markdown).not.toContain('# 97.7%');
        expect(result.richBlocks?.[0]).toMatchObject({ kind: 'html', source: { kind: 'dom-capture', surface: 'html' } });
        expect(result.richBlocks?.[0].fallbackMarkdown).toContain('97.7% Success');
    });

    it('keeps bracketed labels as one valid internal image binding', () => {
        const root = document.createElement('div');
        root.innerHTML = '<div data-message-author-role="assistant" data-message-id="a"><div class="markdown prose"><svg aria-label="Diagram [one]" viewBox="0 0 10 10"><path d="M0 0L10 10"/></svg></div></div>';
        const result = copyMarkdownFromMessage(new ChatGPTAdapter(), root.firstElementChild as HTMLElement);
        expect(result.ok).toBe(true);
        if (!result.ok) return;
        expect(result.markdown).toMatch(/^!\[Diagram \\\[one\\\]\]\(aimd-rich:/);
        expect(result.richBlocks?.[0].label).toBe('Diagram [one]');
    });
});

describe('lightweight SVG sanitization', () => {
    it('retains self-contained geometry and local definitions', () => {
        const result = sanitizeLightweightSvg('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 80"><defs><linearGradient id="g"><stop offset="0" stop-color="red"/></linearGradient></defs><path d="M0 0L10 10" fill="url(#g)"/></svg>');
        expect(result.kind).toBe('ready');
        if (result.kind !== 'ready') return;
        expect(result.svg).toContain('url(#g)');
        expect(result.svg).toContain('xmlns="http://www.w3.org/2000/svg"');
        expect(result).toMatchObject({ width: 120, height: 80 });
    });

    it.each([
        '<!DOCTYPE svg [<!ENTITY secret "unsafe">]><svg xmlns="http://www.w3.org/2000/svg"/>',
        '<svg><script>alert(1)</script><path/></svg>',
        '<svg onload="alert(1)"><path/></svg>',
        '<svg><use href="https://example.com/a.svg#p"/></svg>',
        '<svg><path style="fill:url(https://example.com/a.svg)"/></svg>',
        '<svg><style>@import "https://example.com/font.css";</style><path/></svg>',
        '<svg viewBox="0 0 100000 100000"><path/></svg>',
        '<svg><path style="background-image:image-set(\'https://example.com/p.png\' 1x)"/></svg>',
    ])('rejects active, externally dependent or oversized SVG rather than saving a misleading partial image', (source) => {
        expect(sanitizeLightweightSvg(source).kind).toBe('unavailable');
    });

    it('rejects foreignObject as a vector original instead of deleting its HTML labels', () => {
        expect(sanitizeLightweightSvg('<svg><foreignObject><div xmlns="http://www.w3.org/1999/xhtml">Label</div></foreignObject></svg>'))
            .toEqual({ kind: 'unavailable', reason: 'unsupported' });
    });

    it('defers inherited CSS paints to a live bitmap capture instead of sealing incomplete vectors', () => {
        expect(sanitizeLightweightSvg('<svg><path fill="currentColor"/></svg>'))
            .toEqual({ kind: 'unavailable', reason: 'unsupported' });
        expect(sanitizeLightweightSvg('<svg class="host-colored"><path/></svg>'))
            .toEqual({ kind: 'unavailable', reason: 'unsupported' });
    });
});
