import { describe, expect, it } from 'vitest';
import { isHighlightableTextSelection } from '@/services/reader/highlightSelection';

describe('isHighlightableTextSelection', () => {
    it('allows prose beside a code block without hiding the whole message', () => {
        document.body.innerHTML = '<div id="root"><p>ordinary text</p><div data-markdown-copy="code-block"><code>special code</code></div></div>';
        const root = document.querySelector<HTMLElement>('#root')!;
        const range = document.createRange(); range.selectNodeContents(root.querySelector('p')!);
        expect(isHighlightableTextSelection(range, root)).toBe(true);
    });

    it('rejects mixed selections crossing a code block or editable surface', () => {
        document.body.innerHTML = '<div id="root"><p>before</p><div data-markdown-copy="code-block"><code>code</code></div><p>middle</p><div contenteditable="true">draft</div><p>after</p></div>';
        const root = document.querySelector<HTMLElement>('#root')!;
        const paragraphs = root.querySelectorAll('p');
        const range = document.createRange();
        range.setStart(paragraphs[0]!.firstChild!, 0);
        range.setEnd(paragraphs[1]!.firstChild!, 3);
        expect(isHighlightableTextSelection(range, root)).toBe(false);
        range.setStart(paragraphs[1]!.firstChild!, 0);
        range.setEnd(paragraphs[2]!.firstChild!, 3);
        expect(isHighlightableTextSelection(range, root)).toBe(false);
    });

    it('allows text across paragraphs, inline code and formulas, including display math', () => {
        document.body.innerHTML = '<div id="root"><p>first <code>value</code></p><p>second <span class="katex"><span class="katex-mathml"><math><annotation>x</annotation></math></span><span class="katex-html">x</span></span></p><span class="katex-display"><span class="katex"><span class="katex-html">y</span></span></span><p>last</p></div>';
        const root = document.querySelector<HTMLElement>('#root')!;
        const paragraphs = root.querySelectorAll('p');
        const range = document.createRange();
        range.setStart(paragraphs[0]!.firstChild!, 0);
        range.setEnd(paragraphs[1]!.firstChild!, 3);
        expect(isHighlightableTextSelection(range, root)).toBe(true);
        range.selectNodeContents(root.querySelector('.katex-display')!);
        expect(isHighlightableTextSelection(range, root)).toBe(true);
        range.selectNodeContents(root.querySelector('code')!);
        expect(isHighlightableTextSelection(range, root)).toBe(true);
    });

    it('rejects citation controls and tables but keeps adjacent prose eligible', () => {
        document.body.innerHTML = '<div id="root"><p>sentence</p><p>with <a data-testid="chatgpt-citation">source</a></p><table><tr><td>cell</td></tr></table>';
        const root = document.querySelector<HTMLElement>('#root')!;
        const range = document.createRange();
        range.selectNodeContents(root.querySelector('p')!);
        expect(isHighlightableTextSelection(range, root)).toBe(true);
        for (const selector of ['[data-testid="chatgpt-citation"]', 'td']) {
            range.selectNodeContents(root.querySelector(selector)!);
            expect(isHighlightableTextSelection(range, root)).toBe(false);
        }
    });

    it('requires a complete inline atom so an offered swatch can produce a durable source', () => {
        document.body.innerHTML = '<div id="root"><p><code>answer</code> <span class="katex"><span class="katex-html">x+y</span></span></p></div>';
        const root = document.querySelector<HTMLElement>('#root')!;
        const range = document.createRange();
        const code = root.querySelector('code')!.firstChild!;
        range.setStart(code, 1); range.setEnd(code, 4);
        expect(isHighlightableTextSelection(range, root)).toBe(false);
        const math = root.querySelector('.katex-html')!.firstChild!;
        range.setStart(math, 0); range.setEnd(math, 1);
        expect(isHighlightableTextSelection(range, root)).toBe(false);
    });
});
