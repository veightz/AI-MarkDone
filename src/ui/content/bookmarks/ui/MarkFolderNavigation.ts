import { PathUtils } from '../../../../core/bookmarks/path';
import { emptyMarkCatalog, type MarkCatalog, type MarkFolder, type MarkConversation, type MarkLibraryOperation } from '../../../../contracts/markLibrary';
import { readerAnnotationDocumentKey, type ReaderAnnotationDocument } from '../../../../contracts/readerAnnotations';
import { markLibraryClient } from '../../../../drivers/shared/clients/markLibraryClient';
import type { ModalHost } from '../../components/ModalHost';
import { createIcon } from '../../components/Icon';
import { t } from '../../components/i18n';
import { folderIcon, folderOpenIcon, folderPlusIcon, chevronRightIcon, editIcon, moveIcon, trashIcon, checkIcon } from '../../../../assets/workspaceIcons';
export type MarkFolderScope = string | null | undefined;
export class MarkFolderNavigation {
    readonly root = document.createElement('section');
    catalog: MarkCatalog = emptyMarkCatalog();
    readonly metadata = new Map<string, MarkConversation>();
    private folderIds = new Set<string>();
    scope: MarkFolderScope;
    pending = false;
    available = false;
    private readonly scroll = document.createElement('div');
    private readonly tree = document.createElement('div');
    private readonly actions = document.createElement('div');
    private readonly headingTitle = document.createElement('span');
    private readonly expanded = new Set<string>();
    private lastWindowStart = -1;
    private visible: Array<{
        folder: MarkFolder;
        depth: number;
    }> = [];
    private readonly all: HTMLButtonElement;
    private readonly unfiled: HTMLButtonElement;
    constructor(private readonly modal: ModalHost, private readonly changed: (scope: MarkFolderScope) => void, private readonly updated: () => void) {
        this.root.className = 'library-mark-folders';
        this.root.hidden = true;
        const heading = document.createElement('div');
        heading.className = 'library-folder-heading';
        this.headingTitle.textContent = t('foldersLabel');
        heading.append(this.headingTitle);
        heading.append(this.button(t('createFolder'), () => void this.renameFolder(), folderPlusIcon));
        this.all = this.button(t('allLabel'), () => this.select(undefined));
        this.unfiled = this.button(t('libraryUnfiled'), () => this.select(null));
        this.all.className = this.unfiled.className = 'library-folder-scope';
        this.scroll.className = 'library-folders-scroll';
        this.tree.className = 'library-mark-folder-tree';
        this.scroll.append(this.tree);
        this.scroll.addEventListener('scroll', () => this.paint());
        this.actions.className = 'library-folder-actions';
        this.root.append(heading, this.all, this.unfiled, this.scroll, this.actions);
    }
    reset(): void { this.scope = undefined; this.expanded.clear(); this.scroll.scrollTop = 0; }
    setLabel(label: string): void { this.headingTitle.textContent = label; }
    setAvailable(available: boolean): void { this.available = available; this.setBusy(this.pending); }
    setBusy(busy: boolean): void { this.root.toggleAttribute('inert', busy || !this.available); }
    update(catalog: MarkCatalog): void {
        this.catalog = catalog;
        this.metadata.clear();
        catalog.conversations.forEach(item => this.metadata.set(readerAnnotationDocumentKey(item.document), item));
        this.folderIds = new Set(catalog.folders.map(f => f.id));
        if (this.scope && !catalog.folders.some(f => f.id === this.scope))
            this.scope = undefined;
        this.visible = [];
        const children = new Map<string | null, MarkFolder[]>();
        for (const folder of catalog.folders) {
            const list = children.get(folder.parentId) ?? [];
            list.push(folder);
            children.set(folder.parentId, list);
        }
        const visit = (parent: string | null, depth: number) => {
            if (depth > 4)
                return;
            for (const folder of (children.get(parent) ?? []).sort((a, b) => a.name.localeCompare(b.name))) {
                this.visible.push({ folder, depth });
                if (this.expanded.has(folder.id))
                    visit(folder.id, depth + 1);
            }
        };
        visit(null, 1);
        this.paint(true);
        this.all.setAttribute('aria-pressed', String(this.scope === undefined));
        this.unfiled.setAttribute('aria-pressed', String(this.scope === null));
        this.actions.replaceChildren();
        const folder = catalog.folders.find(f => f.id === this.scope);
        if (folder)
            this.actions.append(this.button(t('renameFolder'), () => void this.renameFolder(folder), editIcon), this.button(t('moveFolder'), () => void this.moveFolder(folder), moveIcon), this.button(t('deleteFolder'), () => void this.removeFolder(folder), trashIcon));
    }
    folderFor(document: ReaderAnnotationDocument): string | null {
        const folderId = this.metadata.get(readerAnnotationDocumentKey(document))?.folderId;
        return folderId && this.folderIds.has(folderId) ? folderId : null;
    }
    private select(scope: MarkFolderScope): void { if (this.pending)
        return; this.scope = scope; this.update(this.catalog); this.changed(scope); }
    private button(label: string, action: () => void, icon?: string): HTMLButtonElement {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'secondary-btn';
        button.setAttribute('aria-label', label);
        button.title = label;
        if (icon)
            button.append(createIcon(icon));
        else
            button.textContent = label;
        button.addEventListener('click', action);
        return button;
    }
    private paint(force = false): void {
        const height = this.tree.querySelector<HTMLElement>('.library-folder-row')?.getBoundingClientRect().height || 40;
        const start = Math.max(0, Math.min(this.visible.length - 40, Math.floor(this.scroll.scrollTop / height) - 4));
        if (!force && start === this.lastWindowStart) return;
        this.lastWindowStart = start;
        this.tree.replaceChildren();
        const space = (size: number) => { const el = document.createElement('div'); el.style.height = `${size}px`; el.setAttribute('aria-hidden', 'true'); return el; };
        this.tree.append(space(start * height));
        for (const { folder, depth } of this.visible.slice(start, start + 40)) {
            const row = document.createElement('div');
            row.className = 'library-folder-row';
            row.dataset.active = String(this.scope === folder.id);
            row.style.paddingInlineStart = `calc(var(--aimd-space-3) * ${depth - 1})`;
            const hasChildren = this.catalog.folders.some(f => f.parentId === folder.id);
            const arrow = this.button(t('libraryExpandFolder'), () => { this.expanded.has(folder.id) ? this.expanded.delete(folder.id) : this.expanded.add(folder.id); this.update(this.catalog); [...this.tree.querySelectorAll<HTMLButtonElement>('[data-toggle-folder]')].find(b => b.dataset.toggleFolder === folder.id)?.focus(); }, chevronRightIcon);
            arrow.className = 'icon-btn';
            arrow.disabled = !hasChildren;
            arrow.dataset.toggleFolder = folder.id;
            arrow.setAttribute('aria-expanded', String(this.expanded.has(folder.id)));
            const label = this.button(folder.name, () => { this.select(folder.id); [...this.tree.querySelectorAll<HTMLButtonElement>('[data-folder-id]')].find(b => b.dataset.folderId === folder.id)?.focus(); });
            label.className = 'library-folder-label';
            label.dataset.folderId = folder.id;
            label.setAttribute('aria-pressed', String(this.scope === folder.id));
            label.prepend(createIcon(folderIcon));
            row.append(arrow, label);
            this.tree.append(row);
        }
        this.tree.append(space(Math.max(0, this.visible.length - start - 40) * height));
    }
    private satisfied(operation: MarkLibraryOperation, catalog: MarkCatalog): boolean {
        if (operation.type === 'folder-remove')
            return !catalog.folders.some(f => f.id === operation.id);
        if (operation.type === 'folder-put')
            return catalog.folders.some(f => f.id === operation.id && f.name === PathUtils.getFolderNameValidation(operation.name).normalized && f.parentId === operation.parentId);
        if (operation.type === 'rename')
            return catalog.conversations.some(c => readerAnnotationDocumentKey(c.document) === readerAnnotationDocumentKey(operation.document) && c.customTitle === (operation.title?.trim() || null));
        return operation.documents.every(document => catalog.conversations.some(c => readerAnnotationDocumentKey(c.document) === readerAnnotationDocumentKey(document) && c.folderId === operation.folderId));
    }
    async commit(operation: MarkLibraryOperation): Promise<void> {
        if (this.pending || !this.available)
            throw new Error(t('librarySaveFailed'));
        this.pending = true;
        this.setBusy(true);
        try {
            let next: MarkCatalog;
            try {
                next = await markLibraryClient.mutate(operation, this.catalog.revision);
            }
            catch (error) {
                // Unknown delivery is reconciled by reading; never blindly repeat a mutation.
                next = await markLibraryClient.get();
                this.update(next);
                this.updated();
                if (!this.satisfied(operation, next))
                    throw error;
            }
            this.update(next);
            this.updated();
        }
        finally {
            this.pending = false;
            this.setBusy(false);
        }
    }
    private async renameFolder(folder?: MarkFolder): Promise<void> {
        const id = folder?.id ?? crypto.randomUUID();
        const parentId = folder ? folder.parentId : this.scope ?? null;
        await this.modal.prompt({ canDismiss: () => !this.pending, kind: 'info', title: t(folder ? 'renameFolder' : 'createFolder'), message: '', defaultValue: folder?.name ?? '', confirmText: t('btnSave'), cancelText: t('btnCancel'),
            validate: value => ({ ok: PathUtils.getFolderNameValidation(value).isValid, message: t('libraryFolderNameInvalid') }),
            onSubmit: async (name) => { try {
                await this.commit({ type: 'folder-put', create: !folder, id, parentId, name });
                if (parentId)
                    this.expanded.add(parentId);
                this.select(id);
                return null;
            }
            catch {
                return t('libraryFolderSaveFailed');
            } },
        });
    }
    private async removeFolder(folder: MarkFolder): Promise<void> {
        const occupied = this.catalog.folders.some(f => f.parentId === folder.id) || this.catalog.conversations.some(c => c.folderId === folder.id);
        if (occupied) {
            await this.modal.alert({ kind: 'info', title: t('deleteFolder'), message: t('libraryFolderNotEmpty'), confirmText: t('btnOk') });
            return;
        }
        if (await this.modal.confirm({ kind: 'warning', title: t('deleteFolder'), message: folder.name, confirmText: t('btnDelete'), cancelText: t('btnCancel'), danger: true })) {
            try {
                await this.commit({ type: 'folder-remove', id: folder.id });
                this.select(undefined);
            }
            catch {
                await this.modal.alert({ kind: 'error', title: t('deleteFolder'), message: t('libraryFolderSaveFailed'), confirmText: t('btnOk') });
            }
        }
    }
    private async moveFolder(folder: MarkFolder): Promise<void> {
        await this.chooseFolder(t('moveFolder'), folder.parentId, async target => {
            await this.commit({ type: 'folder-put', id: folder.id, name: folder.name, parentId: target });
            for (let parent = target; parent; parent = this.catalog.folders.find(f => f.id === parent)?.parentId ?? null)
                this.expanded.add(parent);
            this.select(folder.id);
        }, folder.id);
    }
    async moveConversations(documents: ReaderAnnotationDocument[]): Promise<void> {
        const current = documents.length === 1 ? this.folderFor(documents[0]) : undefined;
        await this.chooseFolder(t('libraryMoveConversations'), current, target => this.commit({ type: 'move', documents, folderId: target }));
    }
    private async chooseFolder(title: string, current: MarkFolderScope, save: (target: string | null) => Promise<void>, exclude?: string): Promise<void> {
        const body = document.createElement('div');
        body.className = 'library-folder-picker';
        const note = document.createElement('p');
        note.textContent = t(exclude ? 'libraryMoveFolderHint' : 'libraryMoveConversationHint');
        body.append(note);
        const path = (folder: MarkFolder): string => { const parts = [folder.name]; let parent = folder.parentId; const seen = new Set([folder.id]); while (parent && !seen.has(parent)) {
            seen.add(parent);
            const f = this.catalog.folders.find(f => f.id === parent);
            if (!f)
                break;
            parts.unshift(f.name);
            parent = f.parentId;
        } return parts.join(' / '); };
        const depth = (folder: MarkFolder): number => { let value = 0; let parent = folder.parentId; const seen = new Set([folder.id]); while (parent && !seen.has(parent)) {
            seen.add(parent);
            const ancestor = this.catalog.folders.find(f => f.id === parent);
            if (!ancestor) break;
            value++;
            parent = ancestor.parentId;
        } return value; };
        const options = document.createElement('div');
        options.className = 'library-folder-picker__options';
        options.setAttribute('role', 'listbox');
        options.setAttribute('aria-label', t('libraryMoveTo'));
        const unset = '__choose_destination__';
        let selectedValue = current === undefined ? unset : current ?? '';
        let confirmButton: HTMLButtonElement | null = null;
        let cancelButton: HTMLButtonElement | null = null;
        let optionButtons: HTMLButtonElement[] = [];
        const sync = () => {
            optionButtons.forEach(option => {
                const selected = option.dataset.folderId === selectedValue;
                option.dataset.selected = String(selected);
                option.setAttribute('aria-selected', String(selected));
                option.querySelector('.library-folder-picker__selected')?.toggleAttribute('data-active', selected);
            });
            const currentValue = current === undefined ? unset : current ?? '';
            const busy = this.pending;
            if (confirmButton) confirmButton.disabled = busy || selectedValue === unset || (current !== undefined && selectedValue === currentValue);
            if (cancelButton) cancelButton.disabled = busy;
            optionButtons.forEach(option => { option.disabled = busy; });
        };
        const choices: Array<{ value: string; label: string; depth: number; icon: string }> = [{
            value: '',
            label: t(exclude ? 'libraryRootFolder' : 'libraryUnfiled'),
            depth: 0,
            icon: folderOpenIcon,
        }];
        for (const folder of [...this.catalog.folders].sort((a, b) => path(a).localeCompare(path(b)))) {
            let ancestor: string | null = folder.id;
            let forbidden = false;
            const seen = new Set<string>();
            while (ancestor && !seen.has(ancestor)) {
                seen.add(ancestor);
                if (ancestor === exclude) {
                    forbidden = true;
                    break;
                }
                ancestor = this.catalog.folders.find(f => f.id === ancestor)?.parentId ?? null;
            }
            if (forbidden)
                continue;
            choices.push({ value: folder.id, label: folder.name, depth: depth(folder), icon: folderIcon });
        }
        optionButtons = choices.map(choice => {
            const option = document.createElement('button');
            option.type = 'button';
            option.className = 'library-folder-picker__option';
            option.dataset.folderId = choice.value;
            option.setAttribute('role', 'option');
            option.style.paddingInlineStart = 'calc(var(--aimd-space-3) + var(--aimd-space-4) * ' + choice.depth + ')';
            const icon = createIcon(choice.icon);
            const label = document.createElement('span');
            label.textContent = choice.label;
            label.title = choice.value ? path(this.catalog.folders.find(folder => folder.id === choice.value)!) : choice.label;
            const selected = document.createElement('span');
            selected.className = 'library-folder-picker__selected';
            selected.setAttribute('aria-hidden', 'true');
            selected.append(createIcon(checkIcon));
            option.append(icon, label, selected);
            option.addEventListener('click', () => { selectedValue = choice.value; sync(); });
            options.append(option);
            return option;
        });
        body.append(options);
        const error = document.createElement('p');
        error.className = 'mock-modal__error';
        error.setAttribute('role', 'alert');
        body.append(error);
        await this.modal.showCustom({ canDismiss: () => !this.pending, kind: 'info', title, body, footer: (footer, close) => {
                cancelButton = this.button(t('btnCancel'), close);
                confirmButton = this.button(t('confirmAction'), () => { void (async () => { confirmButton!.disabled = true; cancelButton!.disabled = true; optionButtons.forEach(option => { option.disabled = true; }); try {
                    await save(selectedValue === '' ? null : selectedValue);
                    close();
                }
                catch {
                    error.textContent = t('libraryFolderSaveFailed');
                }
                finally {
                    sync();
                } })(); });
                confirmButton.classList.add('secondary-btn--primary');
                sync();
                footer.append(cancelButton, confirmButton);
            } });
    }
}
