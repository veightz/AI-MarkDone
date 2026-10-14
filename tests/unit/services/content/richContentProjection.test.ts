import { describe, expect, it } from 'vitest';
import type { RichBlockV1 } from '@/contracts/richContent';
import { projectRichContentMarkdown } from '@/services/content/richContentProjection';

const block: RichBlockV1 = {
    id: 'rich-1-abc', kind: 'svg', label: '图表', fallbackMarkdown: '> [图表未附带]',
    visualDigest: 'abc', source: { kind: 'unavailable', reason: 'unsupported' },
};

describe('rich-content exact-source projection', () => {
    it('expands canonical image nodes using their original UTF-16 spans and preserves the source', () => {
        const source = `😀 Before.\n\n![图表](aimd-rich:${block.id})\n\nAfter.`;
        const result = projectRichContentMarkdown(source, [block], { key: 'message', revision: 'rev-1' });
        expect(result).toMatchObject({ status: 'ready', kind: 'rich-content', revision: 'rev-1' });
        if (result.status !== 'ready' || result.kind !== 'rich-content') return;
        expect(result.markdown).toBe('😀 Before.\n\n> [图表未附带]\n\nAfter.');
        expect(result.bindings[0].span).toEqual({ revision: 'rev-1', start: source.indexOf('!['), end: source.indexOf(')') + 1 });
        expect(source).toContain('aimd-rich:');
    });

    it('uses prepared asset Markdown without replacing inline-code or fenced-code lookalikes', () => {
        const marker = `![图表](aimd-rich:${block.id})`;
        const source = `${marker}\n\n\`${marker}\`\n\n\`\`\`md\n${marker}\n\`\`\``;
        const result = projectRichContentMarkdown(source, [block], {
            replacements: [{ id: block.id, markdown: '![图表](assets/diagram.svg)' }],
        });
        expect(result.status).toBe('ready');
        if (result.status !== 'ready' || result.kind !== 'rich-content') return;
        expect(result.bindings).toHaveLength(1);
        expect(result.markdown).toBe(`![图表](assets/diagram.svg)\n\n\`${marker}\`\n\n\`\`\`md\n${marker}\n\`\`\``);
    });

    it('gives unknown internal images a readable fallback without leaking an internal URL', () => {
        const result = projectRichContentMarkdown('![Unknown chart](aimd-rich:missing)', []);
        expect(result.status).toBe('ready');
        if (result.status !== 'ready' || result.kind !== 'rich-content') return;
        expect(result.markdown).toContain('Unknown chart');
        expect(result.markdown).not.toContain('aimd-rich:');
        expect(result.diagnostics).not.toHaveLength(0);
    });
});
