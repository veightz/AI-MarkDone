import type { Theme } from '../../core/types/theme';
import { isReaderSessionRichContentWithinBudget, type ReaderSessionSnapshot } from '../../contracts/protocol';
import { resolveContent, type ReaderItem } from './types';
import { freezeRichBlocks } from '../../contracts/richContent';

export async function buildReaderSessionSnapshot(params: {
    items: ReaderItem[];
    startIndex: number;
    sourceUrl: string;
    theme: Theme;
    annotationDocument?: ReaderSessionSnapshot['annotationDocument'];
    now?: number;
}): Promise<ReaderSessionSnapshot> {
    const now = params.now ?? Date.now();
    const items = [];
    for (const item of params.items) {
        items.push({
            id: item.id,
            userPrompt: item.userPrompt,
            content: await resolveContent(item.content),
            ...(item.sourceContent !== undefined
                ? { sourceContent: await resolveContent(item.sourceContent) }
                : {}),
            meta: item.meta ? { ...item.meta } : undefined,
            ...(item.richBlocks !== undefined ? { richBlocks: freezeRichBlocks(item.richBlocks.map(block => (
                block.source.kind === 'loaded-image'
                    // A descriptor is not a display URL. Live capture still
                    // requires exact message identity and the sealed digest.
                    ? { ...block, source: { ...block.source, url: 'aimd-source:live-image' } }
                    : block
            ))) } : {}),
        });
    }
    if (!isReaderSessionRichContentWithinBudget({ items })) throw new Error('Detached Reader rich content metadata exceeds the session budget');
    return {
        items,
        startIndex: Math.max(0, Math.min(params.startIndex, Math.max(0, items.length - 1))),
        sourceUrl: params.sourceUrl,
        theme: params.theme,
        createdAt: now,
        updatedAt: now,
        ...(params.annotationDocument ? { annotationDocument: params.annotationDocument } : {}),
    };
}
