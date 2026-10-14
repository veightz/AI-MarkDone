import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';

type MarkdownNode = {
    type?: string;
    position?: { start?: { offset?: number }; end?: { offset?: number } };
    children?: MarkdownNode[];
};

const processor = unified().use(remarkParse).use(remarkGfm).use(remarkMath);

/** Source spans protect code delimiters and whitespace without interpreting its contents. */
export function protectMarkdownCode(markdown: string): { masked: string; withoutCode: string; codeBlockCount: number; restore: (value: string) => string } {
    const ranges: Array<{ start: number; end: number }> = [];
    let codeBlockCount = 0;
    const visit = (node: MarkdownNode): void => {
        if (node.type === 'code' || node.type === 'inlineCode') {
            const start = node.position?.start?.offset;
            const end = node.position?.end?.offset;
            if (typeof start === 'number' && typeof end === 'number' && end > start) {
                ranges.push({ start, end });
                if (node.type === 'code') codeBlockCount += 1;
            }
            return;
        }
        node.children?.forEach(visit);
    };
    visit(processor.parse(markdown) as MarkdownNode);
    let prefix = '\uE000AIMD_CODE_';
    while (markdown.includes(prefix)) prefix += '_';
    const suffix = '\uE001';
    const protectedCode: string[] = [];
    let masked = markdown;
    for (const { start, end } of ranges.sort((left, right) => right.start - left.start)) {
        const index = protectedCode.push(markdown.slice(start, end)) - 1;
        masked = `${masked.slice(0, start)}${prefix}${index}${suffix}${masked.slice(end)}`;
    }
    return {
        masked,
        withoutCode: masked.replace(new RegExp(`${prefix}\\d+${suffix}`, 'g'), ''),
        codeBlockCount,
        restore: (value) => value.replace(new RegExp(`${prefix}(\\d+)${suffix}`, 'g'),
            (_match, index: string) => protectedCode[Number(index)]!),
    };
}

export function normalizeMarkdownWhitespace(markdown: string): string {
    const code = protectMarkdownCode(markdown);
    return code.restore(code.masked.replace(/\n{3,}/g, '\n\n').trim());
}
