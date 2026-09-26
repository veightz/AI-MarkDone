import type { Bookmark, FolderTreeNode } from '../../../../core/bookmarks/types';
import { buildBookmarkDedupeKey } from '../../../../core/bookmarks/keys';
import type { BookmarksPanelController, BookmarksPanelSnapshot } from '../BookmarksPanelController';
import { createIcon } from '../../components/Icon';
import { t } from '../../components/i18n';
import { markTransientRoot } from '../../components/transientUi';
import { bookmarkIcon, bookMarkedIcon, copyIcon, editIcon, folderIcon, folderPlusIcon, moreHorizontalIcon, moveIcon, trashIcon, chevronLeftIcon, chevronRightIcon, chevronDownIcon } from '../../../../assets/workspaceIcons';
import { libraryDate } from './libraryDate';

type Actions = {
    selectFolder(path: string | null): void;
    toggleFolderExpanded(path: string): void;
    toggleFolderSelection(path: string): void;
    toggleBookmarkSelection(bookmark: Bookmark): void;
    openBookmark(bookmark: Bookmark): Promise<void> | void;
    goToBookmark(bookmark: Bookmark): Promise<void> | void;
    copyBookmark(bookmark: Bookmark): Promise<void> | void;
    renameBookmark(bookmark: Bookmark): Promise<void> | void;
    moveBookmark(bookmark: Bookmark): Promise<void> | void;
    deleteBookmark(bookmark: Bookmark): Promise<void> | void;
    createFolder(): Promise<void> | void;
    createSubfolder(path: string): Promise<void> | void;
    renameFolder(path: string): Promise<void> | void;
    moveFolder(path: string): Promise<void> | void;
    deleteFolder(path: string): Promise<void> | void;
};

const PAGE_SIZE = 20;
const FOLDER_ROW_HEIGHT = 40;
const FOLDER_OVERSCAN = 6;
const keyOf = (bookmark: Bookmark) => buildBookmarkDedupeKey(bookmark);

function button(label: string, action: () => void, svg?: string): HTMLButtonElement {
    const result = document.createElement('button');
    result.type = 'button';
    result.className = svg ? `icon-btn${svg === trashIcon ? ' icon-btn--danger' : ''}` : 'secondary-btn';
    result.setAttribute('aria-label', label);
    result.title = label;
    result.dataset.tooltip = label;
    if (svg) result.append(createIcon(svg));
    else result.textContent = label;
    result.addEventListener('click', (event) => { event.stopPropagation(); action(); });
    return result;
}

/** Projects existing bookmark snapshots; mutations stay with the current action owner. */
export class LibraryBookmarkPresentation {
    private readonly root = document.createElement('div');
    private readonly navigation = document.createElement('div');
    private readonly folders = document.createElement('div');
    private readonly list = document.createElement('div');
    private readonly footer = document.createElement('div');
    private snapshot: BookmarksPanelSnapshot | null = null;
    private page = 1;
    private scope = '';
    private managing = false;
    private folderSignature = '';
    private folderRows: Array<{ node: FolderTreeNode; depth: number }> = [];
    private readonly actions: Actions;
    private readonly controller: BookmarksPanelController;

    constructor(params: { controller: BookmarksPanelController; actions: Actions }) {
        this.actions = params.actions;
        this.controller = params.controller;
        this.root.className = 'tree-panel library-collection';
        this.navigation.className = 'library-folder-navigation';
        const header = document.createElement('div');
        header.className = 'library-folder-heading';
        const title = document.createElement('span');
        title.textContent = t('libraryFolders');
        header.append(title, button(t('createFolder'), () => void this.actions.createFolder(), folderPlusIcon));
        this.folders.className = 'library-folders-scroll';
        this.folders.addEventListener('scroll', () => {
            if (this.folderRows.length > 240) this.renderFolders(true);
        }, { passive: true });
        this.navigation.append(header, this.folders);
        this.list.className = 'library-records';
        this.footer.className = 'library-pagination';
        this.root.append(this.list, this.footer);
    }

    getElement(): HTMLElement { return this.root; }
    getNavigationElement(): HTMLElement { return this.navigation; }
    getScrollTop(): number { return this.root.scrollTop; }
    restoreScroll(top: number): void { this.root.scrollTop = top; }
    destroy(): void { this.dismissTransientUi(); this.navigation.remove(); this.snapshot = null; }
    dismissTransientUi(): void {
        this.navigation.querySelectorAll('details[open]').forEach((element) => element.removeAttribute('open'));
        this.root.querySelectorAll('details[open]').forEach((element) => element.removeAttribute('open'));
    }
    closeDetail(): boolean { return false; }
    setManagementMode(enabled: boolean): void {
        this.managing = enabled;
        this.folderSignature = '';
        if (this.snapshot) this.update(this.snapshot);
    }
    selectPage(): void {
        if (!this.snapshot) return;
        this.controller.selectBookmarks(this.snapshot.vm.bookmarks.slice((this.page - 1) * PAGE_SIZE, this.page * PAGE_SIZE));
    }

    update(snapshot: BookmarksPanelSnapshot): void {
        this.snapshot = snapshot;
        const scope = JSON.stringify([snapshot.vm.query, snapshot.vm.kind, snapshot.vm.selectedFolderPath]);
        if (scope !== this.scope) { this.page = 1; this.scope = scope; }
        const signature = JSON.stringify([snapshot.vm.folderTree.map((node) => this.folderState(node)), snapshot.vm.selectedFolderPath, [...snapshot.selectedKeys], this.managing]);
        if (signature !== this.folderSignature) {
            this.folderSignature = signature;
            this.folderRows = [];
            const visit = (nodes: FolderTreeNode[], depth: number) => {
                for (const node of nodes) {
                    this.folderRows.push({ node, depth });
                    if (node.isExpanded) visit(node.children, depth + 1);
                }
            };
            visit(snapshot.vm.folderTree, 0);
            this.renderFolders();
        }
        const records = snapshot.vm.bookmarks;
        const totalPages = Math.max(1, Math.ceil(records.length / PAGE_SIZE));
        this.page = Math.min(this.page, totalPages);
        this.list.replaceChildren();
        if (!records.length && snapshot.dataState?.kind !== 'error') {
            const empty = document.createElement('p');
            empty.className = 'library-empty';
            empty.textContent = snapshot.vm.query ? t('libraryNoMatches') : t('libraryEmpty');
            this.list.append(empty);
        }
        for (const bookmark of records.slice((this.page - 1) * PAGE_SIZE, this.page * PAGE_SIZE)) this.list.append(this.recordRow(bookmark));
        this.footer.replaceChildren();
        const count = document.createElement('span');
        count.textContent = t('libraryRecordCount', String(records.length));
        this.footer.append(count);
        if (totalPages > 1) {
            const controls = document.createElement('span');
            const previous = button(t('libraryPreviousPage'), () => { this.page--; this.update(snapshot); }, chevronLeftIcon);
            const next = button(t('libraryNextPage'), () => { this.page++; this.update(snapshot); }, chevronRightIcon);
            previous.disabled = this.page === 1;
            next.disabled = this.page === totalPages;
            controls.append(previous, document.createTextNode(`${this.page} / ${totalPages}`), next);
            this.footer.append(controls);
        }
    }

    private folderState(node: FolderTreeNode): unknown {
        return [node.folder.path, node.isExpanded, node.children.map((child) => this.folderState(child))];
    }

    private renderedFolderWindow = '';
    private renderFolders(scrollOnly = false): void {
        const snapshot = this.snapshot;
        if (!snapshot) return;
        const virtual = this.folderRows.length > 240;
        const first = virtual ? Math.max(0, Math.floor(this.folders.scrollTop / FOLDER_ROW_HEIGHT) - FOLDER_OVERSCAN) : 0;
        const count = virtual ? Math.ceil((this.folders.clientHeight || 480) / FOLDER_ROW_HEIGHT) + FOLDER_OVERSCAN * 2 : this.folderRows.length;
        const windowKey = `${first}:${count}`;
        if (scrollOnly && windowKey === this.renderedFolderWindow) return;
        this.renderedFolderWindow = windowKey;
        const rows = this.folderRows.slice(first, first + count);
        const inner = document.createElement('div');
        if (virtual) {
            inner.style.paddingTop = `${first * FOLDER_ROW_HEIGHT}px`;
            inner.style.paddingBottom = `${Math.max(0, this.folderRows.length - first - rows.length) * FOLDER_ROW_HEIGHT}px`;
        }
        for (const { node, depth } of rows) {
            const path = node.folder.path;
            const row = document.createElement('div');
            row.className = 'library-folder-row';
            row.dataset.active = String(snapshot.vm.selectedFolderPath === path);
            row.style.paddingInlineStart = `calc(var(--aimd-space-3) * ${depth})`;
            const expand = button(t('libraryExpandFolder'), () => this.actions.toggleFolderExpanded(path), node.isExpanded ? chevronDownIcon : chevronRightIcon);
            expand.disabled = node.children.length === 0;
            expand.setAttribute('aria-expanded', String(node.isExpanded));
            row.append(expand);
            if (this.managing) {
                const check = document.createElement('input'); check.type = 'checkbox';
                const state = this.controller.getFolderCheckboxState(path);
                check.checked = state.checked; check.indeterminate = state.indeterminate;
                check.setAttribute('aria-label', t('librarySelectFolder', path));
                check.addEventListener('change', () => this.actions.toggleFolderSelection(path)); row.append(check);
            }
            const select = button(node.folder.name, () => { this.controller.clearSelection(); this.controller.setQuery(''); this.actions.selectFolder(path); });
            select.className = 'library-folder-label'; select.title = path;
            select.prepend(createIcon(folderIcon));
            row.append(select);
            const active = snapshot.vm.selectedFolderPath === path;
            const folderActions: Array<[string, () => Promise<void> | void]> = [
                [t('createSubfolder'), () => this.actions.createSubfolder(path)],
            ];
            if (active) {
                const rename = button(t('renameFolder'), () => void this.actions.renameFolder(path), editIcon);
                rename.dataset.action = 'rename-folder';
                rename.classList.add('library-folder-rename-button');
                row.append(rename);
            } else {
                folderActions.push([t('renameFolder'), () => this.actions.renameFolder(path)]);
            }
            folderActions.push(
                [t('moveFolder'), () => this.actions.moveFolder(path)],
                [t('deleteFolder'), () => this.actions.deleteFolder(path)],
            );
            row.append(this.menu(folderActions));
            inner.append(row);
        }
        this.folders.replaceChildren(inner);
    }

    private menu(items: Array<[string, () => Promise<void> | void]>): HTMLElement {
        const menu = markTransientRoot(document.createElement('details')); menu.className = 'library-more';
        const trigger = document.createElement('summary'); trigger.setAttribute('aria-label', t('libraryMore'));
        trigger.append(createIcon(moreHorizontalIcon));
        const content = document.createElement('div'); content.className = 'library-menu-items';
        for (const [label, action] of items) content.append(button(label, () => { menu.open = false; void action(); }));
        menu.append(trigger, content);
        menu.addEventListener('toggle', () => {
            if (!menu.open) return;
            for (const root of [this.root, this.navigation]) root.querySelectorAll<HTMLDetailsElement>('details[open]').forEach((other) => { if (other !== menu) other.open = false; });
            const rect = trigger.getBoundingClientRect();
            // The translated panel establishes the fixed-position containing block.
            const bounds = trigger.closest('.aimd-panel')?.getBoundingClientRect() ?? {left:0,top:0,width:window.innerWidth,height:window.innerHeight};
            const width = content.offsetWidth || 160;
            const height = content.offsetHeight || items.length * 40;
            content.style.left = `${Math.max(8, Math.min(rect.right - bounds.left - width, bounds.width - width - 8))}px`;
            content.style.top = `${Math.max(8, Math.min(rect.bottom - bounds.top, bounds.height - height - 8))}px`;
        });
        menu.addEventListener('click', (event) => event.stopPropagation());
        return menu;
    }

    private recordRow(bookmark: Bookmark): HTMLElement {
        const row = document.createElement('div'); row.className = 'library-record library-bookmark-record';
        row.dataset.bookmarkId = keyOf(bookmark);
        if (this.managing) {
            const check = document.createElement('input'); check.type = 'checkbox';
            check.checked = this.snapshot!.selectedKeys.has(`bm:${keyOf(bookmark)}`);
            check.setAttribute('aria-label', t('librarySelectRecord', bookmark.title));
            check.addEventListener('change', () => this.actions.toggleBookmarkSelection(bookmark)); row.append(check);
        } else row.append(createIcon(bookmarkIcon));
        const open = button(bookmark.title, () => void this.actions.openBookmark(bookmark));
        open.className = 'library-record-copy library-bookmark-open';
        open.dataset.action = 'library-open-bookmark-reader';
        const title = document.createElement('strong'); title.textContent = bookmark.title;
        const excerpt = document.createElement('span'); excerpt.textContent = (bookmark.aiResponse || bookmark.userMessage || bookmark.url).slice(0,240);
        open.replaceChildren(title, excerpt);
        const savedAt = libraryDate(bookmark.timestamp);
        if (savedAt) open.append(savedAt);
        row.append(open);
        const actions = document.createElement('div');
        actions.className = 'library-record-actions';
        if (bookmark.kind !== 'page') {
            actions.append(
                button(t('openConversationLabel'), () => void this.actions.goToBookmark(bookmark), bookMarkedIcon),
                button(t('btnCopyText'), () => void this.actions.copyBookmark(bookmark), copyIcon),
            );
        }
        actions.append(
            button(t('renameBookmarkLabel'), () => void this.actions.renameBookmark(bookmark), editIcon),
            button(t('moveBookmarkLabel'), () => void this.actions.moveBookmark(bookmark), moveIcon),
            button(t('btnDelete'), () => void this.actions.deleteBookmark(bookmark), trashIcon),
        );
        row.append(actions);
        return row;
    }
}
