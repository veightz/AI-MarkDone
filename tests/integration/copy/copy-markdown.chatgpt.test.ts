import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ChatGPTAdapter } from '@/drivers/content/adapters/sites/chatgpt';
import { copyMarkdownFromPage } from '@/services/copy/copy-markdown';
import { renderMarkdownForReader } from '@/services/renderer/renderMarkdown';

describe('copyMarkdownFromPage (ChatGPT)', () => {
    it.each(['python', ''])('keeps explicitly marked code blocks fenced without a pre element (language: %s)', (language) => {
        document.body.innerHTML = '<div data-message-author-role="assistant" data-message-id="a1"><div class="markdown prose"><div data-markdown-copy="code-block"><code></code></div><p>This sentence should appear <strong>outside</strong> the code block.</p></div></div>';
        const block = document.querySelector('[data-markdown-copy="code-block"]')!;
        if (language) {
            const header = document.createElement('span');
            header.setAttribute('data-code-language', language);
            header.textContent = 'Python';
            block.prepend(header);
        }
        const source = 'def calculate_area(width, height):\n    area = width * height\n    return area\n\nprint(calculate_area(4, 5))';
        block.querySelector('code')!.textContent = source;

        const result = copyMarkdownFromPage(new ChatGPTAdapter());

        expect(result.ok).toBe(true);
        if (result.ok) expect(result.markdown).toBe(`\`\`\`${language}\n${source}\n\`\`\`\n\nThis sentence should appear **outside** the code block.`);
    });

    it.each(['python', ''])('preserves code whitespace and embedded fences with language %j', (language) => {
        document.body.innerHTML = '<div data-message-author-role="assistant" data-message-id="a1"><div class="markdown prose"><p>Before.</p><pre><code></code></pre><p>After <code>`value`</code>.</p></div></div>';
        const code = document.querySelector('pre code')!;
        if (language) code.className = `language-${language}`;
        const source = '    first()\n\n\n    ```\n    https://example.com/$x$\n    last()';
        code.textContent = source;

        const result = copyMarkdownFromPage(new ChatGPTAdapter());

        expect(result.ok).toBe(true);
        if (!result.ok) return;
        expect(result.markdown).toBe(`Before.\n\n\`\`\`\`${language}\n${source}\n\`\`\`\`\n\nAfter \`\` \`value\` \`\`.`);
        const rendered = document.createElement('div');
        rendered.innerHTML = renderMarkdownForReader(result.markdown).html;
        expect(rendered.querySelector('pre code')?.textContent).toBe(`${source}\n`);
        expect(rendered.querySelector('p:last-child code')?.textContent).toBe('`value`');
    });

    it.each([
        ['cm-content', false], ['lexical', false], ['cm-content', true], ['lexical', true],
    ] as const)('keeps editor code lines intact for %s (empty-line br: %s)', (kind, emptyLineBreak) => {
        document.body.innerHTML = '<div data-message-author-role="assistant" data-message-id="a1"><div class="markdown prose"><pre><div class="editor"></div></pre></div></div>';
        const editor = document.querySelector('.editor')!;
        if (kind === 'cm-content') editor.classList.add('cm-content');
        else editor.setAttribute('data-lexical-editor', 'true');
        const lines = ['    one', '', '', '    two'];
        for (const line of lines) {
            const row = document.createElement(kind === 'cm-content' ? 'div' : 'p');
            if (kind === 'cm-content') row.className = 'cm-line';
            row.textContent = line;
            if (!line && emptyLineBreak) row.appendChild(document.createElement('br'));
            editor.appendChild(row);
        }

        const result = copyMarkdownFromPage(new ChatGPTAdapter());

        expect(result.ok).toBe(true);
        if (result.ok) expect(result.markdown).toBe(`\`\`\`\n${lines.join('\n')}\n\`\`\``);
    });

    it('extracts current code-viewer blocks as fenced markdown without leaking header chrome', () => {
        const html = readFileSync('tests/testdata/chatgpt/code-viewer.html', 'utf-8');
        document.documentElement.innerHTML = `<head></head><body>${html}</body>`;

        const adapter = new ChatGPTAdapter();
        const res = copyMarkdownFromPage(adapter);
        expect(res.ok).toBe(true);
        if (!res.ok) return;

        expect(res.markdown).toContain('```latex');
        expect(res.markdown).toContain('Against this background');
        expect(res.markdown).not.toContain('LaTeXAgainst this background');
        expect(res.markdown).not.toContain('CopyAgainst this background');
    }, 20_000);
});
