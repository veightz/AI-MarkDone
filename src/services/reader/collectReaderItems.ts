import type { SiteAdapter } from '../../drivers/content/adapters/base';
import type { ReaderItem } from './types';
import type { CopyMarkdownResult } from '../copy/copy-markdown';
import { freezeRichBlocks, type RichBlockV1 } from '../../contracts/richContent';
import { collectConversationTurnRefs, type ConversationTurnRef } from '../../drivers/content/conversation/collectConversationTurnRefs';
import { copyMarkdownFromTurn } from '../copy/copy-turn-markdown';

export type CollectReaderItemsResult = {
    items: ReaderItem[];
    startIndex: number;
};

export type GetMarkdownFn = (messageElement: HTMLElement) => string;

export function stripHash(url: string): string {
    try {
        const parsed = new URL(url);
        parsed.hash = '';
        return `${parsed.origin}${parsed.pathname}${parsed.search}`;
    } catch {
        return url.split('#')[0] || url;
    }
}

export function collectReaderItems(
    adapter: SiteAdapter,
    startMessageElement: HTMLElement,
    getMarkdown?: GetMarkdownFn
): CollectReaderItemsResult {
    const turns = collectConversationTurnRefs(adapter);
    const pageUrl = stripHash(window.location.href);

    const startIndexRaw = turns.findIndex((t) =>
        t.messageEls.some((el) => el === startMessageElement || el.contains(startMessageElement) || startMessageElement.contains(el))
    );
    const startIndex = startIndexRaw >= 0 ? startIndexRaw : Math.max(0, turns.length - 1);

    const items: ReaderItem[] = turns.map((turn, index) =>
        buildReaderItemFromTurn(adapter, turn, index, pageUrl, getMarkdown)
    );

    return { items, startIndex };
}

export function buildReaderItemFromTurn(
    adapter: SiteAdapter,
    turn: ConversationTurnRef,
    index: number,
    pageUrl: string,
    getMarkdown?: GetMarkdownFn
): ReaderItem {
    const messageId = turn.messageId;
    const common = {
        id: `${adapter.getPlatformId()}-${messageId ?? index}`,
        userPrompt: turn.userPrompt,
        meta: {
            platformId: adapter.getPlatformId(),
            messageId,
            position: index + 1,
            url: pageUrl,
            bookmarkable: true,
            bookmarked: false,
        },
    };
    if (getMarkdown) {
        return { ...common, content: () => turn.messageEls.map(el => getMarkdown(el).trim()).filter(Boolean).join('\n\n') };
    }
    // Keep lazy loading, while content and its sidecar describe one immutable
    // capture even if the host later mutates or virtualizes this message.
    let captured: CopyMarkdownResult | undefined;
    let richBlocks: readonly RichBlockV1[] | undefined;
    const read = () => captured ??= copyMarkdownFromTurn(adapter, turn.messageEls);
    return {
        ...common,
        content: () => { const result = read(); return result.ok ? result.markdown : ''; },
        get sourceContent() { const result = read(); return result.ok ? result.sourceMarkdown : undefined; },
        get richBlocks() {
            const result = read();
            if (!result.ok || result.richBlocks === undefined) return undefined;
            return richBlocks ??= freezeRichBlocks(result.richBlocks);
        },
    };
}
