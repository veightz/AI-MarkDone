import { describe, expect, it, vi } from 'vitest';

vi.mock('@/drivers/content/clipboard/clipboard', () => ({
    copyTextToClipboard: vi.fn(async () => true),
}));

import { copyTextToClipboard } from '@/drivers/content/clipboard/clipboard';
import { ChatGPTAdapter } from '@/drivers/content/adapters/sites/chatgpt';
import { MessageToolbar } from '@/ui/content/MessageToolbar';
import { MessageToolbarOrchestrator } from '@/ui/content/controllers/MessageToolbarOrchestrator';
import { WordCounter } from '@/core/text/wordCounter';
import { readFileSync } from 'node:fs';

describe('ChatGPT toolbar Copy Markdown code preservation', () => {
    it('refuses a stale toolbar copy immediately when inner message ownership changes before the observer runs', async () => {
        document.body.innerHTML = `<article data-turn="assistant"><div data-message-author-role="assistant" data-message-id="answer-A">
          <div data-chatgpt-selection-message-id="answer-A"><div class="markdown prose"><div data-dil-source-message-id="answer-A"><div data-dil-message-id="answer-A"><p>Original answer</p></div></div></div></div>
        </div><div class="z-0 flex"><button data-testid="copy-turn-action-button">Copy</button></div></article>`;
        const adapter = new ChatGPTAdapter();
        const message = document.querySelector<HTMLElement>('[data-message-id]')!;
        const orchestrator = new MessageToolbarOrchestrator(adapter, {}) as any;
        const toolbar = new MessageToolbar('light', orchestrator.getActionsForMessage(message, () => toolbar));
        adapter.injectToolbar(message, toolbar.getElement());
        vi.mocked(copyTextToClipboard).mockClear();
        try {
            message.querySelector('[data-dil-message-id]')!.setAttribute('data-dil-message-id', 'answer-B');
            message.querySelector('p')!.textContent = 'Different answer body';
            const button = toolbar.getElement().shadowRoot!.querySelector<HTMLButtonElement>('[data-action="copy_markdown"]')!;
            button.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, composed: true }));
            button.click();
            await Promise.resolve();
            await Promise.resolve();
            expect(copyTextToClipboard).not.toHaveBeenCalled();
        } finally { toolbar.dispose(); orchestrator.dispose(); adapter.dispose(); }
    });
    it('copies the current ChatGPT code/editor and inline markers through the real toolbar button', async () => {
        document.body.innerHTML = readFileSync('tests/testdata/chatgpt/semantic-code-blocks.html', 'utf8');
        const expected = [
            '```python\ndef calculate_area(width, height):\n    area = width * height\n    return area\n\nprint(calculate_area(4, 5))\n```',
            'This sentence should appear **outside** the code block.',
            '```\nTEST_BLOCK_START\nThis text should remain inside a fenced Markdown code block.\n\nline 1\nline 2\nline 3\nTEST_BLOCK_END\n```',
            'And here is inline code: `npm install -g @openai/codex`.',
            'Inline formula: $x+y$.',
            '$$\nE=mc^2\n$$',
        ].join('\n\n');
        const adapter = new ChatGPTAdapter();
        const message = document.querySelector<HTMLElement>('[data-message-id]')!;
        const orchestrator = new MessageToolbarOrchestrator(adapter, {}) as any;
        const toolbar = new MessageToolbar('light', orchestrator.getActionsForMessage(message, () => toolbar));
        adapter.injectToolbar(message, toolbar.getElement());
        try {
            toolbar.getElement().shadowRoot!.querySelector<HTMLButtonElement>('[data-action="copy_markdown"]')!.click();
            await vi.waitFor(() => expect(copyTextToClipboard).toHaveBeenLastCalledWith(expected));
        } finally { toolbar.dispose(); orchestrator.dispose(); }
    });

    it.each(['pre', 'marked-div'])('copies fenced code and inline-code boundaries through the actual toolbar button (%s)', async (shape) => {
        document.body.innerHTML = `
          <article data-turn="assistant">
            <div data-message-author-role="assistant" data-message-id="code-answer">
              <div class="markdown prose"><p>Before <code>\`value\`</code>.</p><pre><code class="language-python"></code></pre><p>After.</p></div>
            </div>
            <div class="z-0 flex"><div><button data-testid="copy-turn-action-button">Copy</button></div></div>
          </article>
        `;
        if (shape === 'marked-div') {
            const pre = document.querySelector('pre')!;
            const block = document.createElement('div');
            block.setAttribute('data-markdown-copy', 'code-block');
            block.append(...pre.childNodes);
            pre.replaceWith(block);
        }
        const source = '    first()\n\n\n    ```\n    last()';
        document.querySelector('.markdown code.language-python')!.textContent = source;
        const adapter = new ChatGPTAdapter();
        const message = document.querySelector<HTMLElement>('[data-message-id]')!;
        const orchestrator = new MessageToolbarOrchestrator(adapter, {}) as any;
        const toolbar = new MessageToolbar('light', orchestrator.getActionsForMessage(message, () => toolbar));
        adapter.injectToolbar(message, toolbar.getElement());

        try {
            const button = toolbar.getElement().shadowRoot!.querySelector<HTMLButtonElement>('[data-action="copy_markdown"]')!;
            button.click();
            await vi.waitFor(() => expect(copyTextToClipboard).toHaveBeenCalledWith(
                `Before \`\` \`value\` \`\`.\n\n\`\`\`\`python\n${source}\n\`\`\`\`\n\nAfter.`,
            ));
            const copied = vi.mocked(copyTextToClipboard).mock.calls.at(-1)![0];
            expect(new WordCounter().count(copied)).toMatchObject({ chars: 11, excluded: { codeBlocks: 1 } });
        } finally {
            toolbar.dispose();
            orchestrator.dispose();
        }
    });
});
