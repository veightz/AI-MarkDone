import { highlightsClient } from '../../../../drivers/shared/clients/highlightsClient';
import { readerAnnotationsClient } from '../../../../drivers/shared/clients/readerAnnotationsClient';
import { unwrapRuntimeClientResult } from '../../../../drivers/shared/clients/clientResult';
import { browser } from '../../../../drivers/shared/browser';
import { isReaderAnnotationDocument, isReaderAnnotationRecord, readerAnnotationDocumentKey, type ReaderAnnotationDocument } from '../../../../contracts/readerAnnotations';
import { isChatGPTPageUrl } from '../../../../contracts/chatgptHosts';
import type { HighlightColor, HighlightEntry } from '../../../../contracts/highlights';
import { MarkFolderNavigation } from './MarkFolderNavigation';
import { markLibraryClient } from '../../../../drivers/shared/clients/markLibraryClient';
import { readMarkDocumentTitle } from '../../../../drivers/content/chatgpt/readMarkDocumentTitle';
import { usableConversationTitle } from '../../../../contracts/markLibrary';
import { fromReaderAnnotationRecord, toReaderAnnotationRecord, type ReaderCommentRecord } from '../../../../services/reader/commentSession';
import { copyTextToClipboard } from '../../../../drivers/content/clipboard/clipboard';
import type { LibraryAnnotationPort } from '../BookmarksPanelPort';
import type { ModalHost } from '../../components/ModalHost';
import { createHighlightSwatches } from '../../components/HighlightSwatches';
import { renderLibrarySelectionBar } from './components/LibrarySelectionBar';
import { createIcon } from '../../components/Icon';
import { t } from '../../components/i18n';
import { chevronLeftIcon, chevronRightIcon, searchIcon, messageSquareTextIcon, highlighterIcon, xIcon, chevronDownIcon, checkIcon, editIcon, moveIcon, bookOpenIcon, trashIcon } from '../../../../assets/workspaceIcons';
import { libraryDate } from './libraryDate';
export type LibraryMarkType = 'annotations' | 'highlights';
type AnnotationEntry = {
    type: 'annotations';
    document: ReaderAnnotationDocument;
    record: ReaderCommentRecord;
};
type MarkEntry = AnnotationEntry | ({
    type: 'highlights';
} & HighlightEntry);
type ConversationGroup = {
    key: string;
    document: ReaderAnnotationDocument;
    entries: MarkEntry[];
    updatedAt: number;
};
const recordOf = (entry: MarkEntry) => entry.type === 'annotations' ? entry.record : entry.highlight;
const keyOf = (entry: MarkEntry) => `${entry.type}:${readerAnnotationDocumentKey(entry.document)}:${recordOf(entry).id}`;
function originalUrl(document: ReaderAnnotationDocument): string {
    const url = document.lastKnownUrl;
    if (url && isChatGPTPageUrl(url)) {
        const id = new URL(url).pathname.match(/(?:^|\/)(?:c|conversation)\/([^/?#]+)/)?.[1];
        if (id === document.conversationId)
            return url;
    }
    return `https://chatgpt.com/c/${encodeURIComponent(document.conversationId)}`;
}
/** On-demand projections of original stores. Only the current page is mounted. */
export class LibraryMarksView {
    readonly root = document.createElement('section');
    private readonly heading = document.createElement('h2');
    private readonly search = document.createElement('input');
    private readonly notice = document.createElement('div');
    private readonly collection = document.createElement('div');
    private readonly detail = document.createElement('aside');
    readonly folders: MarkFolderNavigation;
    private expandedConversation: string | null | undefined;
    private groupPage = 1;
    private groupMode = false;
    private selectedGroups = new Set<string>();
    private groupDocuments = new Map<string, ReaderAnnotationDocument>();
    private filteredGroups: ConversationGroup[] = [];
    private pageGroups: ConversationGroup[] = [];
    private readonly batch = document.createElement('div');
    private readonly manage: HTMLButtonElement;
    private batchMode = false;
    private readonly batchKeys = new Set<string>();
    private pageEntries: MarkEntry[] = [];
    private type: LibraryMarkType | null = null;
    private entries: MarkEntry[] = [];
    private titles = new Map<string, string>();
    private page = 1;
    private generation = 0;
    private pending = false;
    private refreshPending = false;
    private selected: string | null = null;
    private editing = false;
    private loaded = false;
    private unsubscribes: Array<() => void> = [];
    constructor(private readonly options: {
        modal: ModalHost;
        annotations?: LibraryAnnotationPort;
        openTemplates: () => void;
    }) {
        this.folders = new MarkFolderNavigation(options.modal, () => { this.page = this.groupPage = 1; this.expandedConversation = undefined; this.batchKeys.clear(); this.selectedGroups.clear(); this.closeDetail(); this.renderList(); }, () => { this.closeDetail(); this.selectedGroups.clear(); this.batchKeys.clear(); this.renderList(); });
        this.root.className = 'library-marks';
        this.root.hidden = true;
        const header = document.createElement('header');
        header.className = 'library-heading';
        header.append(this.heading);
        this.manage = this.button(t('libraryManage'), () => { this.batchMode = true; this.groupMode = false; this.batch.replaceChildren(); this.closeDetail(); this.renderList(); }, checkIcon);
        header.append(this.manage);
        this.batch.className = 'library-batch library-selection-bar';
        this.batch.hidden = true;
        const field = document.createElement('label');
        field.className = 'search-field';
        this.search.type = 'search';
        this.search.placeholder = t('librarySearchMarks');
        this.search.setAttribute('aria-label', t('librarySearchMarks'));
        field.append(createIcon(searchIcon), this.search);
        this.search.addEventListener('input', () => { this.page = this.groupPage = 1; this.expandedConversation = undefined; this.batchKeys.clear(); this.selectedGroups.clear(); this.closeDetail(); this.renderList(); });
        this.collection.className = 'library-collection';
        this.notice.className = 'library-marks-notice';
        this.notice.setAttribute('role', 'alert');
        this.notice.hidden = true;
        this.detail.className = 'library-detail';
        this.detail.hidden = true;
        this.root.append(header, field, this.batch, this.notice, this.collection, this.detail);
    }
    activate(type: LibraryMarkType | null): void {
        if (this.type === type)
            return;
        this.unsubscribes.splice(0).forEach(stop => stop());
        this.generation++;
        this.type = type;
        this.root.hidden = !type;
        this.entries = [];
        this.filteredGroups = [];
        this.pageGroups = [];
        this.loaded = false;
        this.page = 1;
        this.search.value = '';
        this.refreshPending = false;
        this.finishRefresh = null;
        this.closeDetail();
        this.expandedConversation = undefined;
        this.groupPage = 1;
        this.groupMode = false;
        this.selectedGroups.clear();
        this.batchMode = false;
        this.batchKeys.clear();
        this.batch.replaceChildren();
        this.folders.reset();
        this.folders.setAvailable(false);
        this.folders.root.hidden = !type;
        if (!type)
            return;
        this.folders.setLabel(t(type === 'annotations' ? 'libraryAnnotationFolders' : 'libraryHighlightFolders'));
        this.heading.textContent = t(type === 'annotations' ? 'libraryAnnotations' : 'libraryHighlights');
        if (type === 'highlights')
            this.unsubscribes.push(highlightsClient.subscribe(() => { if (!this.pending)
                void this.reload(); }));
        else {
            const changed = (changes: Record<string, unknown>, area: string) => {
                if (!this.pending && area === 'local' && Object.keys(changes).some(key => key.startsWith('aimd:reader_annotations:document:')))
                    void this.reload();
            };
            browser?.storage?.onChanged?.addListener(changed);
            this.unsubscribes.push(() => browser?.storage?.onChanged?.removeListener(changed));
            if (this.options.annotations)
                this.unsubscribes.push(this.options.annotations.subscribe(() => { if (!this.pending)
                    void this.reload(); }));
        }
        this.unsubscribes.push(markLibraryClient.subscribe(() => { if (!this.isBusy())
            void this.reload(); }));
        void this.reload();
    }
    destroy(): void { this.activate(null); }
    isBusy(): boolean { return this.pending || this.folders.pending; }
    closeDetail(): boolean {
        if (this.pending)
            return true;
        const wasOpen = !this.detail.hidden;
        this.refreshPending = false;
        this.finishRefresh = null;
        this.selected = null;
        this.editing = false;
        this.detail.hidden = true;
        this.detail.replaceChildren();
        return wasOpen;
    }
    focusSearch(): void { this.search.focus(); }
    private async reload(): Promise<boolean> {
        const type = this.type;
        const generation = ++this.generation;
        if (!type)
            return false;
        if (!this.loaded) {
            this.collection.textContent = t('loading');
        }
        try {
            const catalogRead = markLibraryClient.get().catch(() => null);
            let entries: MarkEntry[];
            if (type === 'highlights')
                entries = (await highlightsClient.list()).map(entry => ({ type, ...entry }));
            else {
                const result = unwrapRuntimeClientResult(await readerAnnotationsClient.list());
                if (!Array.isArray(result?.entries) || !result.entries.every(entry => isReaderAnnotationDocument(entry.document) && isReaderAnnotationRecord(entry.annotation)))
                    throw new Error('Invalid annotations response');
                const unique = new Map<string, AnnotationEntry>();
                for (const entry of result.entries) {
                    const item: AnnotationEntry = { type, document: entry.document, record: fromReaderAnnotationRecord(entry.annotation, entry.document) };
                    unique.set(keyOf(item), item);
                }
                for (const record of this.options.annotations?.listLive() ?? []) {
                    if (!record.document || !record.target)
                        continue;
                    const item: AnnotationEntry = { type, document: record.document, record };
                    // Durable values from the background win over an older mounted view.
                    if (!unique.has(keyOf(item)))
                        unique.set(keyOf(item), item);
                }
                entries = [...unique.values()];
            }
            const catalog = await catalogRead;
            if (generation !== this.generation)
                return false;
            this.entries = entries.sort((a, b) => recordOf(b).updatedAt - recordOf(a).updatedAt || keyOf(a).localeCompare(keyOf(b)));
            this.folders.setAvailable(catalog !== null);
            if (catalog) this.folders.update(catalog);
            else { this.folders.scope = undefined; this.folders.update(this.folders.catalog); }
            const available = new Set(this.entries.map(keyOf));
            for (const key of this.batchKeys)
                if (!available.has(key))
                    this.batchKeys.delete(key);
            this.loaded = true;
            this.notice.hidden = true;
            this.renderList();
            if (!catalog) this.showError(t('libraryFoldersUnavailable'));
            if (this.selected && !this.editing) {
                const entry = this.entries.find(entry => keyOf(entry) === this.selected);
                if (entry)
                    this.renderDetail(entry);
                else {
                    this.detail.hidden = true;
                    this.selected = null;
                }
            }
            return true;
        }
        catch {
            if (generation === this.generation) {
                if (!this.loaded)
                    this.collection.replaceChildren();
                this.showError(t(this.refreshPending ? 'librarySavedRefreshFailed' : 'libraryReadFailed'));
            }
            return false;
        }
    }
    private showError(message: string): void {
        this.notice.replaceChildren(document.createTextNode(message), this.button(t('libraryRetry'), () => void this.retryRefresh()));
        this.notice.hidden = false;
    }
    private button(label: string, run: () => void, icon?: string): HTMLButtonElement {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'secondary-btn';
        button.setAttribute('aria-label', label);
        button.title = label;
        if (icon)
            button.append(createIcon(icon));
        else
            button.textContent = label;
        button.addEventListener('click', run);
        return button;
    }
    private iconButton(label: string, run: () => void, icon: string): HTMLButtonElement {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'icon-btn';
        button.setAttribute('aria-label', label);
        button.setAttribute('title', label);
        button.dataset.tooltip = label;
        button.append(createIcon(icon));
        button.addEventListener('click', event => { event.stopPropagation(); run(); });
        return button;
    }
    private titleFor(source: ReaderAnnotationDocument): string {
        const key = readerAnnotationDocumentKey(source);
        const cached = this.titles.get(key);
        if (cached) return cached;
        const document = readMarkDocumentTitle(source);
        const item = this.folders.metadata.get(key);
        const title = item?.customTitle || usableConversationTitle(document.title, document.conversationId) || usableConversationTitle(item?.document.title, document.conversationId) || t('libraryUnnamedConversation');
        this.titles.set(key, title);
        return title;
    }
    private renderList(): void {
        this.titles.clear();
        const query = this.search.value.trim().toLocaleLowerCase();
        const groups = new Map<string, ConversationGroup>();
        for (const entry of this.entries) {
            if (this.folders.scope !== undefined && this.folders.folderFor(entry.document) !== this.folders.scope)
                continue;
            const key = readerAnnotationDocumentKey(entry.document);
            let group = groups.get(key);
            if (!group) {
                group = { key, document: entry.document, entries: [], updatedAt: recordOf(entry).updatedAt };
                groups.set(key, group);
            }
            const record = recordOf(entry);
            if (`${this.titleFor(entry.document)} ${record.quoteText} ${entry.type === 'annotations' ? entry.record.comment : ''}`.toLocaleLowerCase().includes(query))
                group.entries.push(entry);
        }
        // Retained organization remains movable even after the last source record is removed.
        for (const item of this.folders.catalog.conversations) {
            const key = readerAnnotationDocumentKey(item.document);
            if (!groups.has(key) && (this.folders.scope === undefined || this.folders.folderFor(item.document) === this.folders.scope))
                groups.set(key, { key, document: item.document, entries: [], updatedAt: item.updatedAt });
        }
        this.groupDocuments = new Map([...groups.values()].map(g => [g.key, g.document]));
        const ordered = [...groups.values()].filter(g => !query || g.entries.length || this.titleFor(g.document).toLocaleLowerCase().includes(query)).sort((a, b) => b.updatedAt - a.updatedAt || a.key.localeCompare(b.key));
        this.filteredGroups = ordered;
        for (const key of this.selectedGroups)
            if (!groups.has(key))
                this.selectedGroups.delete(key);
        const groupPages = Math.max(1, Math.ceil(ordered.length / 20));
        this.groupPage = Math.min(this.groupPage, groupPages);
        this.pageGroups = ordered.slice((this.groupPage - 1) * 20, this.groupPage * 20);
        if (this.expandedConversation === undefined || (this.expandedConversation !== null && !groups.has(this.expandedConversation))) {
            this.expandedConversation = this.pageGroups[0]?.key ?? null;
            this.page = 1;
        }
        this.collection.replaceChildren();
        let pageEntries: MarkEntry[] = [];
        for (const group of this.pageGroups) {
            const section = document.createElement('section');
            section.className = 'library-conversation-group';
            const header = document.createElement('div');
            header.className = 'library-conversation-header';
            const toggle = this.button(this.titleFor(group.document), () => { if (this.isBusy())
                return; this.expandedConversation = this.expandedConversation === group.key ? null : group.key; this.page = 1; this.closeDetail(); this.renderList(); [...this.collection.querySelectorAll<HTMLButtonElement>('[data-conversation-id]')].find(b => b.dataset.conversationId === group.document.conversationId)?.focus(); });
            toggle.className = 'library-conversation-toggle';
            toggle.dataset.conversationId = group.document.conversationId;
            toggle.setAttribute('aria-expanded', String(this.expandedConversation === group.key));
            const label = document.createElement('span');
            label.textContent = this.titleFor(group.document);
            label.title = label.textContent;
            const count = document.createElement('span');
            count.className = 'library-conversation-count';
            count.textContent = String(group.entries.length);
            toggle.replaceChildren(createIcon(chevronDownIcon), label, count);
            if (this.batchMode && this.groupMode) {
                const check = document.createElement('input');
                check.type = 'checkbox';
                check.setAttribute('aria-label', t('librarySelectConversation', this.titleFor(group.document)));
                check.checked = this.selectedGroups.has(group.key);
                check.indeterminate = !check.checked && group.entries.some(entry => this.batchKeys.has(keyOf(entry)));
                check.addEventListener('change', () => { if (check.checked) {
                    this.selectedGroups.add(group.key);
                    group.entries.forEach(e => this.batchKeys.add(keyOf(e)));
                }
                else {
                    this.selectedGroups.delete(group.key);
                    group.entries.forEach(e => this.batchKeys.delete(keyOf(e)));
                } this.renderList(); });
                header.append(check);
            }
            header.append(toggle);
            if (!this.batchMode) {
                const actions = document.createElement('div');
                actions.className = 'library-conversation-actions';
                const entriesButton = this.iconButton(t('librarySelectEntries'), () => { this.batchMode = true; this.groupMode = false; this.batch.replaceChildren(); this.expandedConversation = group.key; this.page = 1; this.closeDetail(); this.renderList(); }, checkIcon);
                const rename = this.iconButton(t('libraryRenameConversation'), () => void this.renameConversation(group.document), editIcon);
                const move = this.iconButton(t('libraryMoveConversations'), () => void this.folders.moveConversations([readMarkDocumentTitle(group.document)]), moveIcon);
                rename.disabled = move.disabled = !this.folders.available;
                const original = document.createElement('a');
                original.className = 'icon-btn library-conversation-action-link';
                original.setAttribute('aria-label', t('libraryOpenOriginal'));
                original.title = t('libraryOpenOriginal');
                original.dataset.tooltip = t('libraryOpenOriginal');
                original.href = originalUrl(group.document);
                original.target = '_blank';
                original.rel = 'noopener noreferrer';
                original.append(createIcon(bookOpenIcon));
                actions.append(entriesButton, rename, move, original);
                header.append(actions);
            }
            section.append(header);
            if (this.expandedConversation === group.key) {
                const rendered = this.renderRecords(group.entries);
                section.append(rendered.list);
                pageEntries = rendered.pageEntries;
            }
            this.collection.append(section);
        }
        this.renderBatch(pageEntries);
        if (!ordered.length) {
            const empty = document.createElement('p');
            empty.className = 'library-empty';
            empty.textContent = t(query ? 'libraryNoMatches' : 'libraryMarksEmpty');
            this.collection.append(empty);
        }
        if (groupPages > 1) {
            const pager = document.createElement('div');
            pager.className = 'library-pagination';
            const prev = this.button(t('libraryPreviousConversations'), () => { this.groupPage--; this.expandedConversation = undefined; this.renderList(); }, chevronLeftIcon);
            prev.disabled = this.groupPage === 1;
            const next = this.button(t('libraryNextConversations'), () => { this.groupPage++; this.expandedConversation = undefined; this.renderList(); }, chevronRightIcon);
            next.disabled = this.groupPage === groupPages;
            pager.append(prev, document.createTextNode(`${this.groupPage} / ${groupPages}`), next);
            this.collection.append(pager);
        }
    }
    private async renameConversation(source: ReaderAnnotationDocument): Promise<void> {
        const document = readMarkDocumentTitle(source);
        await this.options.modal.prompt({ canDismiss: () => !this.folders.pending, kind: 'info', title: t('libraryRenameConversation'), message: t('libraryRenameConversationHint'), defaultValue: this.titleFor(document), confirmText: t('btnSave'), cancelText: t('btnCancel'), validate: value => ({ ok: value.length <= 512, message: t('libraryNameTooLong') }), onSubmit: async (title) => { try {
                await this.folders.commit({ type: 'rename', document, title: title.trim() || null });
                return null;
            }
            catch {
                return t('libraryFolderSaveFailed');
            } } });
    }
    private renderRecords(filtered: MarkEntry[]): {
        list: HTMLElement;
        pageEntries: MarkEntry[];
    } {
        const pages = Math.max(1, Math.ceil(filtered.length / 20));
        this.page = Math.min(this.page, pages);
        const pageEntries = filtered.slice((this.page - 1) * 20, this.page * 20);
        const list = document.createElement('div');
        list.className = 'library-records';
        for (const entry of pageEntries) {
            const record = recordOf(entry);
            const row = document.createElement('button');
            row.type = 'button';
            row.className = 'library-record library-mark-record';
            row.dataset.recordKey = keyOf(entry);
            const icon = createIcon(entry.type === 'annotations' ? messageSquareTextIcon : highlighterIcon);
            icon.classList.add('library-record-icon');
            if (entry.type === 'highlights')
                icon.dataset.color = entry.highlight.color;
            const content = document.createElement('span');
            content.className = 'library-record-content';
            const title = document.createElement('strong');
            title.textContent = entry.type === 'annotations' ? entry.record.comment : record.quoteText;
            const source = document.createElement('span');
            source.textContent = entry.type === 'annotations' ? record.quoteText : '';
            source.hidden = !source.textContent;
            content.append(title, source);
            const savedAt = libraryDate(record.updatedAt);
            if (savedAt) content.append(savedAt);
            row.append(icon, content);
            if (this.batchMode && !this.groupMode) {
                row.setAttribute('aria-pressed', String(this.batchKeys.has(keyOf(entry))));
                const check = document.createElement('span');
                check.className = 'library-selection-check';
                check.textContent = this.batchKeys.has(keyOf(entry)) ? '✓' : '';
                check.setAttribute('aria-hidden', 'true');
                row.prepend(check);
            }
            row.addEventListener('click', () => { if (this.pending)
                return; if (this.batchMode && !this.groupMode) {
                const key = keyOf(entry);
                if (this.batchKeys.has(key))
                    this.batchKeys.delete(key);
                else
                    this.batchKeys.add(key);
                this.renderList();
                [...this.collection.querySelectorAll<HTMLButtonElement>('[data-record-key]')].find(button => button.dataset.recordKey === key)?.focus({ preventScroll: true });
            }
            else if (!this.batchMode)
                this.renderDetail(entry); });
            list.append(row);
        }
        const pager = document.createElement('div');
        pager.className = 'library-pagination';
        const prev = this.button(t('libraryPreviousPage'), () => { this.page--; this.renderList(); }, chevronLeftIcon);
        prev.disabled = this.page === 1;
        const next = this.button(t('libraryNextPage'), () => { this.page++; this.renderList(); }, chevronRightIcon);
        next.disabled = this.page === pages;
        const controls = document.createElement('span');
        controls.append(prev, next);
        pager.append(document.createTextNode(`${filtered.length} · ${this.page} / ${pages}`), controls);
        if (pages > 1)
            list.append(pager);
        if (!filtered.length) {
            const empty = document.createElement('p');
            empty.className = 'library-empty';
            empty.textContent = t('libraryMarksEmpty');
            list.append(empty);
        }
        return { list, pageEntries };
    }
    private renderDetail(entry: MarkEntry): void {
        this.selected = keyOf(entry);
        this.editing = false;
        this.detail.hidden = false;
        this.detail.replaceChildren();
        const header = document.createElement('header');
        header.className = 'library-detail-header';
        const title = document.createElement('h3');
        title.textContent = this.titleFor(entry.document);
        header.append(title, this.button(t('close'), () => this.closeDetail(), xIcon));
        const quote = document.createElement('blockquote');
        quote.textContent = recordOf(entry).quoteText;
        const actions = document.createElement('div');
        actions.className = 'library-detail-actions';
        const original = document.createElement('a');
        original.className = 'secondary-btn';
        original.textContent = t('libraryOpenOriginal');
        original.href = originalUrl(entry.document);
        original.target = '_blank';
        original.rel = 'noopener noreferrer';
        if (entry.type === 'annotations')
            original.addEventListener('click', event => {
                event.preventDefault();
                void this.run(async () => {
                    try {
                        unwrapRuntimeClientResult(await readerAnnotationsClient.navigate(entry.document, entry.record.id));
                    } catch {
                        window.open(original.href, '_blank', 'noopener');
                    }
                }, false);
            });
        actions.append(original);
        this.detail.append(header, quote);
        if (entry.type === 'highlights') {
            actions.append(createHighlightSwatches({ selected: entry.highlight.color, onSelect: color => void this.run(async () => { await highlightsClient.update(entry.document, { ...entry.highlight, color }, entry.highlight.revision); }) }));
        }
        else {
            const note = document.createElement('p');
            note.className = 'library-annotation-text';
            note.textContent = entry.record.comment;
            this.detail.append(note);
            actions.append(this.button(t('btnEdit'), () => this.editAnnotation(entry)), this.button(t('btnCopy'), () => void this.run(async () => { const ok = await copyTextToClipboard(this.options.annotations?.compose(entry.record) ?? entry.record.comment); if (!ok)
                throw new Error('Copy failed'); }, false)));
            if (this.options.annotations?.canInsert(entry.record))
                actions.append(this.button(t('pageAnnotationInsert'), () => void this.run(() => this.options.annotations!.insert(entry.record), false)));
            actions.append(this.button(t('libraryTemplates'), this.options.openTemplates));
        }
        actions.append(this.button(t('btnDelete'), () => void this.remove(entry)));
        this.detail.append(actions);
    }
    private editAnnotation(entry: AnnotationEntry): void {
        this.editing = true;
        const text = document.createElement('textarea');
        text.className = 'library-annotation-editor';
        text.value = entry.record.comment;
        text.setAttribute('aria-label', t('readerCommentUserComment'));
        this.detail.querySelector('.library-annotation-text')?.replaceWith(text);
        const actions = this.detail.querySelector('.library-detail-actions')!;
        actions.replaceChildren();
        actions.append(this.button(t('btnCancel'), () => this.renderDetail(entry)), this.button(t('btnSave'), () => {
            if (!text.value.trim())
                return;
            void this.run(async () => {
                const record = { ...entry.record, comment: text.value, updatedAt: Date.now() };
                if (record.revision === undefined && this.options.annotations)
                    await this.options.annotations.updateLive(record);
                else {
                    const saved = unwrapRuntimeClientResult(await readerAnnotationsClient.update(entry.document, toReaderAnnotationRecord(record, record.target!), record.revision!));
                    if (!isReaderAnnotationRecord(saved.annotation) || saved.annotation.id !== record.id || saved.annotation.revision <= record.revision!)
                        throw new Error('Invalid annotation acknowledgement');
                }
            }, true, () => { this.editing = false; const latest = this.entries.find(item => keyOf(item) === keyOf(entry)); if (latest)
                this.renderDetail(latest); });
        }));
        text.focus();
    }
    private async remove(entry: MarkEntry): Promise<void> {
        if (this.pending)
            return;
        if (!this.refreshPending && !await this.options.modal.confirm({ kind: 'warning', title: t('libraryDeleteMarkTitle'), message: t('libraryDeleteMark'), confirmText: t('btnDelete'), cancelText: t('btnCancel'), danger: true }))
            return;
        await this.run(() => this.deleteEntry(entry), true, () => { this.detail.hidden = true; this.selected = null; });
    }
    private async deleteEntry(entry: MarkEntry): Promise<void> {
        if (entry.type === 'highlights')
            await highlightsClient.remove(entry.document, entry.highlight.id, entry.highlight.revision);
        else if (entry.record.revision === undefined && this.options.annotations)
            await this.options.annotations.removeLive(entry.record);
        else {
            const result = unwrapRuntimeClientResult(await readerAnnotationsClient.remove(entry.document, entry.record.id, entry.record.revision));
            if (result.deleted !== true || result.annotationId !== entry.record.id)
                throw new Error('Invalid annotation deletion acknowledgement');
        }
    }
    private toggleSelectionScope(): void {
        this.groupMode = !this.groupMode;
        this.selectedGroups.clear();
        if (this.groupMode) {
            for (const group of this.filteredGroups) {
                if (group.entries.length > 0 && group.entries.every(entry => this.batchKeys.has(keyOf(entry)))) {
                    this.selectedGroups.add(group.key);
                }
            }
        }
        this.renderList();
    }

    private applySelectionToResults(mode: 'all' | 'invert'): void {
        if (this.groupMode) {
            for (const group of this.filteredGroups) {
                const select = mode === 'all' || !this.selectedGroups.has(group.key);
                if (select) {
                    this.selectedGroups.add(group.key);
                    group.entries.forEach(entry => this.batchKeys.add(keyOf(entry)));
                } else {
                    this.selectedGroups.delete(group.key);
                    group.entries.forEach(entry => this.batchKeys.delete(keyOf(entry)));
                }
            }
        } else {
            for (const entry of this.filteredGroups.flatMap(group => group.entries)) {
                const key = keyOf(entry);
                if (mode === 'all') this.batchKeys.add(key);
                else if (this.batchKeys.has(key)) this.batchKeys.delete(key);
                else this.batchKeys.add(key);
            }
        }
        this.renderList();
    }

    private clearBatchSelection(): void {
        this.batchKeys.clear();
        this.selectedGroups.clear();
        this.renderList();
    }

    private renderBatch(page: MarkEntry[]): void {
        this.pageEntries = page;
        this.batch.hidden = !this.batchMode;
        this.batch.toggleAttribute('inert', !this.batchMode);
        this.manage.hidden = this.batchMode;
        if (!this.batchMode) {
            this.batch.replaceChildren();
            return;
        }

        const selectableOnPage = this.groupMode ? this.pageGroups.length > 0 : this.pageEntries.length > 0;
        const selectableResults = this.groupMode
            ? this.filteredGroups.length > 0
            : this.filteredGroups.some(group => group.entries.length > 0);
        const actions: HTMLElement[] = [];
        const remove = this.iconButton(t('btnDelete'), () => void this.runBatch(), trashIcon);
        remove.dataset.action = 'delete-selected';
        remove.classList.add('icon-btn--danger');
        remove.disabled = this.pending || this.batchKeys.size === 0;
        actions.push(remove);

        if (this.type === 'highlights') {
            const colors = createHighlightSwatches({ onSelect: color => void this.runBatch(color) });
            colors.querySelectorAll('button').forEach(button => {
                button.dataset.needsSelection = '';
                button.disabled = this.pending || this.batchKeys.size === 0;
            });
            actions.push(colors);
        }

        if (this.groupMode) {
            const move = this.iconButton(t('libraryMoveConversations'), () => {
                const documents = [...this.selectedGroups].map(key => this.groupDocuments.get(key)).filter((d): d is ReaderAnnotationDocument => !!d);
                void this.folders.moveConversations(documents.map(readMarkDocumentTitle));
            }, moveIcon);
            move.dataset.action = 'move-selected-conversations';
            move.disabled = this.pending || this.selectedGroups.size === 0 || !this.folders.available;
            actions.push(move);
        }

        renderLibrarySelectionBar(this.batch, {
            summary: this.groupMode
                ? t('librarySelectedConversations', [String(this.selectedGroups.size), String(this.batchKeys.size)])
                : t('selectedCount', String(this.batchKeys.size)),
            scope: {
                action: 'selection-scope-toggle',
                label: t(this.groupMode ? 'librarySwitchToItems' : 'librarySwitchToConversations'),
                onClick: () => this.toggleSelectionScope(),
                disabled: this.pending,
            },
            selectPage: {
                action: 'select-page',
                label: t('librarySelectPage'),
                onClick: () => {
                    if (this.groupMode) {
                        this.pageGroups.forEach(group => {
                            this.selectedGroups.add(group.key);
                            group.entries.forEach(entry => this.batchKeys.add(keyOf(entry)));
                        });
                    } else this.pageEntries.forEach(entry => this.batchKeys.add(keyOf(entry)));
                    this.renderList();
                },
                disabled: this.pending || !selectableOnPage,
            },
            selectAll: {
                action: 'select-all-results',
                label: t('librarySelectAllResults'),
                onClick: () => this.applySelectionToResults('all'),
                disabled: this.pending || !selectableResults,
            },
            invert: {
                action: 'invert-selection',
                label: t('libraryInvertResults'),
                onClick: () => this.applySelectionToResults('invert'),
                disabled: this.pending || !selectableResults,
            },
            clear: {
                action: 'clear-selection',
                label: t('clearSelection'),
                onClick: () => this.clearBatchSelection(),
                disabled: this.pending || (this.batchKeys.size === 0 && this.selectedGroups.size === 0),
            },
            actions,
            done: {
                action: 'manage-done',
                label: t('libraryManageDone'),
                onClick: () => {
                    this.batchMode = false;
                    this.selectedGroups.clear();
                    this.batchKeys.clear();
                    this.batch.replaceChildren();
                    this.renderList();
                    this.manage.focus();
                },
                disabled: this.pending,
            },
        });
    }
    private async runBatch(color?: HighlightColor): Promise<void> {
        if (this.pending || !this.batchKeys.size)
            return;
        if (this.refreshPending) {
            await this.retryRefresh();
            return;
        }
        const selected = this.entries.filter(entry => this.batchKeys.has(keyOf(entry)));
        if (!color && !await this.options.modal.confirm({ kind: 'warning', title: t('libraryDeleteMarkTitle'), message: t('libraryBatchDeleteScope', [String(selected.length), String(new Set(selected.map(entry => readerAnnotationDocumentKey(entry.document))).size)]), confirmText: t('btnDelete'), cancelText: t('btnCancel'), danger: true }))
            return;
        let succeeded = 0;
        let failed = 0;
        await this.run(async () => {
            for (const entry of selected) {
                try {
                    if (color && entry.type === 'highlights')
                        await highlightsClient.update(entry.document, { ...entry.highlight, color }, entry.highlight.revision);
                    else
                        await this.deleteEntry(entry);
                    succeeded++;
                    this.batchKeys.delete(keyOf(entry));
                }
                catch {
                    failed++;
                }
                if ((succeeded + failed) % 5 === 0) {
                    this.notice.textContent = t('libraryBatchProgress', [String(succeeded + failed), String(selected.length)]);
                    this.notice.hidden = false;
                }
            }
        }, true, () => {
            if (failed && this.groupMode) {
                this.groupMode = false;
                this.selectedGroups.clear();
                this.batch.replaceChildren();
            }
            this.notice.textContent = t(color ? 'libraryBatchRecolored' : 'libraryBatchDeleted', String(succeeded)) + (failed ? ` · ${t('libraryBatchIncomplete', String(failed))}` : '');
            this.notice.hidden = false;
        }, () => succeeded > 0);
    }
    private async run(action: () => Promise<void>, refresh = true, done?: () => void, hasWrites?: () => boolean): Promise<void> {
        if (this.pending)
            return;
        if (this.refreshPending) {
            await this.retryRefresh();
            return;
        }
        const type = this.type;
        this.pending = true;
        this.search.disabled = true;
        this.root.querySelectorAll<HTMLButtonElement | HTMLTextAreaElement>('button,textarea').forEach(el => { el.disabled = true; });
        this.folders.setBusy(true);
        try {
            await action();
            if (type !== this.type)
                return;
            if (refresh) {
                this.refreshPending = hasWrites?.() ?? true;
                this.finishRefresh = done ?? null;
                if (!await this.reload())
                    return;
                this.refreshPending = false;
                this.finishRefresh = null;
            }
            done?.();
        }
        catch {
            this.showError(t('librarySaveFailed'));
        }
        finally {
            this.pending = false;
            this.folders.setBusy(false);
            this.search.disabled = false;
            this.root.querySelectorAll<HTMLButtonElement | HTMLTextAreaElement>('button,textarea').forEach(el => { el.disabled = false; });
            this.renderList();
        }
    }
    private finishRefresh: (() => void) | null = null;
    private async retryRefresh(): Promise<void> {
        if (await this.reload()) {
            this.refreshPending = false;
            const finish = this.finishRefresh;
            this.finishRefresh = null;
            finish?.();
        }
    }
}
