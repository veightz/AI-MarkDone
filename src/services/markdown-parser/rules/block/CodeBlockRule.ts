import type { Rule } from '../../core/Rule';

type AdapterWithCustomCodeExtraction = {
    extractCodeBlockText?: (blockElem: HTMLElement) => string | null;
};

function normalizeCodeBlockText(raw: string): string {
    return raw.replace(/\r\n?/g, '\n');
}

function fenceCodeBlock(raw: string, language: string): string {
    const code = normalizeCodeBlockText(raw);
    let longestRun = 0;
    for (const match of code.matchAll(/`+/g)) longestRun = Math.max(longestRun, match[0].length);
    const fence = '`'.repeat(Math.max(3, longestRun + 1));
    return `${fence}${language}\n${code}\n${fence}\n\n`;
}

export function createCodeBlockRule(): Rule {
    return {
        name: 'code-block',
        filter: (node, adapter) => {
            if (node.nodeType !== Node.ELEMENT_NODE) return false;
            return adapter.isCodeBlockNode(node as Element);
        },
        priority: 3,
        replacement: (_content, node, context) => {
            const blockElem = node as HTMLElement;
            const adapter = context.adapter as typeof context.adapter & AdapterWithCustomCodeExtraction;
            const customCode = adapter.extractCodeBlockText?.(blockElem);
            const codeElem =
                blockElem.tagName === 'CODE'
                    ? blockElem
                    : ((blockElem.querySelector('code') as HTMLElement | null) || (blockElem.matches('pre') ? blockElem : null));
            if (customCode !== undefined && customCode !== null) {
                const language = context.adapter.getCodeLanguage(blockElem);
                return fenceCodeBlock(customCode, language);
            }
            if (!codeElem) {
                return fenceCodeBlock(blockElem.textContent || '', '');
            }
            const language = context.adapter.getCodeLanguage(codeElem);
            return fenceCodeBlock(codeElem.textContent || '', language);
        },
    };
}
