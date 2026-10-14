import type { ReaderRichContentResolver } from '../../../services/reader/types';
import type { RichBlockV1 } from '../../../contracts/richContent';
import { prepareRichContentAssets, resolveRichContentMessageRoot } from '../../../drivers/content/export/richContentAssets';

export type { ReaderRichContentLease, ReaderRichContentResolver } from '../../../services/reader/types';

export const prepareReaderRichContent: ReaderRichContentResolver = async (item, signal) => {
    const context = { messageId: item.meta?.assistantMessageId || item.meta?.messageId || undefined, documentUrl: item.meta?.url };
    const lease = await prepareRichContentAssets(item.richBlocks ?? [], {
        ...context, signal, resolveMessageRoot: () => resolveRichContentMessageRoot(context),
    });
    const assets = (item.richBlocks ?? []).flatMap(block => {
        const variants = lease.assets.filter(asset => asset.blockId === block.id && asset.visualDigest === block.visualDigest);
        const asset = variants.find(candidate => candidate.mimeType === 'image/png') ?? variants[0];
        return asset ? [{ blockId: block.id, url: asset.objectUrl, mimeType: asset.mimeType }] : [];
    });
    return { assets, release: lease.release };
};

/** Patch only owned visual slots; surrounding text, selection and annotation nodes stay in place. */
export function hydrateReaderRichSlots(root: HTMLElement, sanitizedHtml: string): void {
    const template = root.ownerDocument.createElement('template');
    template.innerHTML = sanitizedHtml;
    const candidates = Array.from(template.content.querySelectorAll<HTMLElement>('img[data-aimd-rich-block]'));
    for (const slot of root.querySelectorAll<HTMLElement>('span[data-aimd-rich-block]')) {
        const matching = candidates.filter(candidate => candidate.dataset.aimdRichBlock === slot.dataset.aimdRichBlock);
        if (matching.length !== 1) continue;
        slot.replaceChildren(matching[0]!.cloneNode(true));
    }
}

export function fallbackReaderRichSlot(root: HTMLElement, block: RichBlockV1): void {
    for (const image of root.querySelectorAll<HTMLImageElement>('img[data-aimd-rich-block]')) {
        if (image.dataset.aimdRichBlock !== block.id) continue;
        const fallback = root.ownerDocument.createElement('span');
        fallback.dataset.aimdRichBlock = block.id;
        fallback.textContent = block.fallbackMarkdown.replace(/^>\s*/gm, '');
        image.replaceWith(fallback);
    }
}
