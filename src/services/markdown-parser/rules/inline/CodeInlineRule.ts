import type { Rule } from '../../core/Rule';

function fenceInlineCode(code: string): string {
    let maxRun = 0;
    for (const match of code.matchAll(/`+/g)) maxRun = Math.max(maxRun, match[0].length);
    const fence = '`'.repeat(maxRun + 1);
    const padding = /^`|`$/.test(code) || (/^ /.test(code) && / $/.test(code) && /[^ ]/.test(code)) ? ' ' : '';
    return `${fence}${padding}${code}${padding}${fence}`;
}

export function createCodeInlineRule(): Rule {
    return {
        name: 'code-inline',
        filter: ['code'],
        priority: 11,
        replacement: (content, node) => {
            const el = node as HTMLElement;
            if (el.closest('pre')) return content;
            return fenceInlineCode((el.textContent ?? '').replace(/\r\n?|\n/g, ' '));
        },
    };
}
