import type { SiteAdapter } from '../../drivers/content/adapters/base';
import { copyMarkdownFromMessage, type CopyMarkdownResult } from './copy-markdown';
import { freezeRichBlocks, type RichBlockV1 } from '../../contracts/richContent';

export function copyMarkdownFromTurn(adapter: SiteAdapter, messageEls: HTMLElement[]): CopyMarkdownResult {
    let firstError: any = null;
    const parts: string[] = [];
    const sourceParts:string[]=[];
    const richBlocks = new Map<string, RichBlockV1>();

    for (const el of messageEls) {
        const res = copyMarkdownFromMessage(adapter, el);
        if (res.ok) {
            for (const block of res.richBlocks ?? []) richBlocks.set(block.id, block);
            const trimmed = res.markdown.trim();
            if (trimmed) {parts.push(trimmed);sourceParts.push(res.sourceMarkdown??trimmed);}
            continue;
        }
        if (!firstError) firstError = res.error as any;
    }

    const markdown = parts.join('\n\n');
    if (markdown) return {
        ok: true, markdown,
        ...(sourceParts.join('\n\n') !== markdown ? { sourceMarkdown: sourceParts.join('\n\n') } : {}),
        ...(richBlocks.size ? { richBlocks: freezeRichBlocks([...richBlocks.values()]) } : {}),
    };
    if (firstError) return { ok: false, error: firstError as any };
    return { ok: true, markdown: '' };
}
