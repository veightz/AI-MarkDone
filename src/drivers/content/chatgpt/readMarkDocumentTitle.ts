import type { ReaderAnnotationDocument } from '../../../contracts/readerAnnotations';
import { usableConversationTitle } from '../../../contracts/markLibrary';
import { isChatGPTPageUrl } from '../../../contracts/chatgptHosts';
/** Display metadata only. No content discovery, requests, observers or stored-name overrides. */
export function readMarkDocumentTitle(source: ReaderAnnotationDocument): ReaderAnnotationDocument {
    if (usableConversationTitle(source.title, source.conversationId))
        return source;
    if (typeof document === 'undefined' || !isChatGPTPageUrl(location.href))
        return source;
    const currentId = location.pathname.match(/(?:^|\/)c\/([^/]+)/)?.[1];
    if (currentId !== source.conversationId)
        return source;
    const link = typeof CSS === 'undefined' ? null : document.querySelector<HTMLAnchorElement>(`nav a[href$="/c/${CSS.escape(source.conversationId)}"]`);
    const title = usableConversationTitle(link?.textContent, source.conversationId)
        ?? usableConversationTitle(document.title, source.conversationId);
    return title ? { ...source, title } : source;
}
