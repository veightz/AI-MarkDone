import { afterEach, describe, expect, it, vi } from 'vitest';

import { ReaderCommentPopover } from '@/ui/content/reader/ReaderCommentPopover';
import { createAppearanceSnapshot } from '@/style/appearance';
import { annotationDraftsClient } from '@/drivers/shared/clients/annotationDraftsClient';

function createHost(): { host: HTMLElement; shadow: ShadowRoot; container: HTMLElement } {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const shadow = host.attachShadow({ mode: 'open' });
    const container = document.createElement('div');
    container.className = 'panel-window--reader';
    shadow.appendChild(container);
    Object.assign(container, {
        getBoundingClientRect: () => ({
            left: 20,
            top: 20,
            right: 620,
            bottom: 420,
            width: 600,
            height: 400,
            x: 20,
            y: 20,
            toJSON: () => ({}),
        }),
    });
    return { host, shadow, container };
}

describe('ReaderCommentPopover', () => {
    it('does not read or write recovery drafts while typing, blurring, or leaving the page', async () => {
        vi.useFakeTimers();
        const read = vi.spyOn(annotationDraftsClient, 'read').mockResolvedValue({ ok: true, data: { draft: null, revision: 0 } });
        const write = vi.spyOn(annotationDraftsClient, 'write').mockResolvedValue({ ok: true, data: { revision: 1 } });
        const remove = vi.spyOn(annotationDraftsClient, 'remove').mockResolvedValue({ ok: true, data: { revision: 0 } });
        const { shadow, container } = createHost(); const popover = new ReaderCommentPopover(); const onSave = vi.fn();
        const params = { shadow, container, appearance: createAppearanceSnapshot('light'), mode: 'create' as const, selectedSource: 'Quote',
            draftIdentity: { documentKey: 'chatgpt:conversation:manual-save', assistantMessageId: 'assistant', selectionKey: 'selection' },
            anchorRect: { left: 180, top: 320, width: 120, height: 22, right: 300, bottom: 342 }, onSave };
        popover.open(params);
        const input = shadow.querySelector<HTMLTextAreaElement>('[data-role="input"]')!;
        input.value = '尚未保存的注释'; input.dispatchEvent(new Event('input', { bubbles: true }));
        document.body.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, composed: true }));
        document.body.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }));
        window.dispatchEvent(new Event('pagehide'));
        await vi.advanceTimersByTimeAsync(1000);
        expect(popover.isOpen()).toBe(true); expect(input.value).toBe('尚未保存的注释');
        expect(read).not.toHaveBeenCalled(); expect(write).not.toHaveBeenCalled(); expect(onSave).not.toHaveBeenCalled();
        shadow.querySelector<HTMLButtonElement>('[data-action="save"]')!.click();
        await vi.advanceTimersByTimeAsync(1000);
        expect(onSave).toHaveBeenCalledExactlyOnceWith('尚未保存的注释');
        expect(popover.isOpen()).toBe(false);
        popover.destroy();
        expect(read).not.toHaveBeenCalled(); expect(write).not.toHaveBeenCalled(); expect(remove).not.toHaveBeenCalled();
        vi.useRealTimers();
    });

    it('discards unsaved edits on close and opens with only the supplied saved annotation', async () => {
        const { shadow, container } = createHost(); const popover = new ReaderCommentPopover(); const onSave = vi.fn();
        const params = { shadow, container, appearance: createAppearanceSnapshot('light'), mode: 'edit' as const,
            selectedSource: 'Quote', initialText: 'Previously saved',
            anchorRect: { left: 180, top: 320, width: 120, height: 22, right: 300, bottom: 342 }, onSave };
        popover.open(params);
        const input = shadow.querySelector<HTMLTextAreaElement>('[data-role="input"]')!;
        input.value = 'Unsaved edit'; input.dispatchEvent(new Event('input', { bubbles: true }));
        shadow.querySelector<HTMLButtonElement>('[data-action="close"]')!.click();
        await vi.waitFor(() => expect(popover.isOpen()).toBe(false));
        popover.open(params);
        expect(shadow.querySelector<HTMLTextAreaElement>('[data-role="input"]')!.value).toBe('Previously saved');
        expect(onSave).not.toHaveBeenCalled(); popover.destroy();
    });

    it('keeps text on save failure and retries only after another explicit Save', async () => {
        const { shadow, container } = createHost(); const popover = new ReaderCommentPopover();
        const onSave = vi.fn().mockRejectedValueOnce(new Error('Unavailable')).mockResolvedValueOnce(undefined);
        popover.open({ shadow, container, appearance: createAppearanceSnapshot('light'), mode: 'create', selectedSource: 'Quote',
            anchorRect: { left: 180, top: 320, width: 120, height: 22, right: 300, bottom: 342 }, onSave });
        const input = shadow.querySelector<HTMLTextAreaElement>('[data-role="input"]')!;
        input.value = 'My note'; input.dispatchEvent(new Event('input', { bubbles: true }));
        const save = shadow.querySelector<HTMLButtonElement>('[data-action="save"]')!; save.click();
        await vi.waitFor(() => expect(input.disabled).toBe(false));
        expect(popover.isOpen()).toBe(true); expect(input.value).toBe('My note'); expect(onSave).toHaveBeenCalledOnce();
        save.click(); await vi.waitFor(() => expect(popover.isOpen()).toBe(false));
        expect(onSave).toHaveBeenCalledTimes(2); popover.destroy();
    });
    it('keeps one input mounted through minimize and expand and clamps below a scrolled container top', () => {
        const { shadow, container } = createHost();
        container.getBoundingClientRect = () => new DOMRect(20, -300, 600, 900);
        const popover = new ReaderCommentPopover(); popover.open({ shadow, container, appearance: createAppearanceSnapshot('light'), mode: 'create', selectedSource: 'Quote', initialText: 'Keep text and caret',
            anchorRect: { left: 180, top: 50, width: 120, height: 22, right: 300, bottom: 72 }, onSave: vi.fn() });
        const input = shadow.querySelector<HTMLTextAreaElement>('[data-role="input"]')!; const surface = shadow.querySelector<HTMLElement>('.reader-comment-popover')!;
        expect(Number.parseFloat(surface.style.top)).toBeGreaterThanOrEqual(316);
        shadow.querySelector<HTMLButtonElement>('[data-action="minimize"]')!.click(); expect(surface.dataset.minimized).toBe('true');
        shadow.querySelector<HTMLButtonElement>('[data-action="expand"]')!.click(); expect(surface.dataset.expanded).toBe('true'); expect(surface.dataset.minimized).toBe('false');
        expect(shadow.querySelector('[data-role="input"]')).toBe(input); expect(input.value).toBe('Keep text and caret'); popover.destroy();
    });
    it('keeps unsaved annotation text when the reader is clicked outside the editor', () => {
        const { shadow, container } = createHost();
        const popover = new ReaderCommentPopover();
        const onCancel = vi.fn();
        popover.open({
            shadow, container, appearance: createAppearanceSnapshot('light'),
            mode: 'create', selectedSource: 'Selected quote',
            anchorRect: { left: 180, top: 320, width: 120, height: 22, right: 300, bottom: 342 },
            onSave: vi.fn(), onCancel,
        });
        const input = shadow.querySelector<HTMLTextAreaElement>('[data-role="input"]')!;
        input.value = 'An unfinished thought';
        input.dispatchEvent(new Event('input', { bubbles: true }));
        document.body.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }));
        expect(popover.isOpen()).toBe(true);
        expect(input.value).toBe('An unfinished thought');
        expect(onCancel).not.toHaveBeenCalled();
        popover.destroy();
    });
    afterEach(() => {
        vi.useRealTimers();
        vi.restoreAllMocks();
        document.body.innerHTML = '';
    });

    it('anchors above the supplied selection rect instead of centering in the reader shell', () => {
        const { shadow, container } = createHost();
        const popover = new ReaderCommentPopover();

        popover.open({
            shadow,
            container,
            appearance: createAppearanceSnapshot('light'),
            mode: 'create',
            initialText: '',
            selectedSource: 'Before `code` and $x+y$ after',
            anchorRect: {
                left: 180,
                top: 320,
                width: 120,
                height: 22,
                right: 300,
                bottom: 342,
            },
            labels: {},
            onSave: vi.fn(),
        } as any);

        const root = shadow.querySelector<HTMLElement>('.reader-comment-popover');
        expect(root).toBeTruthy();
        expect(root?.style.left).not.toBe('');
        expect(root?.dataset.side).toBe('top');
        expect(shadow.querySelector('.reader-comment-popover__close')?.className).toContain('icon-btn');
        expect(shadow.querySelector('[data-action="discard"]')?.className).toContain('secondary-btn');
        expect(shadow.querySelector('[data-action="save"]')?.className).toContain('secondary-btn--primary');
        expect(shadow.querySelector<HTMLElement>('.reader-comment-popover__shortcut')?.textContent)
            .toBe('Ctrl/Cmd + Enter to save');
        expect(shadow.querySelector<HTMLElement>('.reader-comment-popover__selection-value')?.textContent).toContain('Before `code` and $x+y$ after');
    });

    it('keeps Enter as newline and submits on Ctrl/Cmd+Enter without saving during composition', async () => {
        const { shadow, container } = createHost();
        const popover = new ReaderCommentPopover();
        const onSave = vi.fn();

        popover.open({
            shadow,
            container,
            appearance: createAppearanceSnapshot('light'),
            mode: 'create',
            initialText: 'seed',
            selectedSource: 'seed source',
            anchorRect: {
                left: 180,
                top: 320,
                width: 120,
                height: 22,
                right: 300,
                bottom: 342,
            },
            labels: {},
            onSave,
        } as any);

        const input = shadow.querySelector<HTMLTextAreaElement>('.reader-comment-popover__input');
        expect(input).toBeTruthy();
        expect(input!.getAttribute('aria-label')).toBe(input!.placeholder);

        input!.value = 'line 1';
        input!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
        expect(onSave).not.toHaveBeenCalled();
        input!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', shiftKey: true, bubbles: true, cancelable: true }));
        expect(onSave).not.toHaveBeenCalled();

        input!.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true }));
        input!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', ctrlKey: true, bubbles: true, cancelable: true }));
        expect(onSave).not.toHaveBeenCalled();
        input!.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true }));

        input!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
        expect(onSave).not.toHaveBeenCalled();

        input!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', metaKey: true, bubbles: true, cancelable: true }));
        expect(onSave).toHaveBeenCalledWith('line 1');
        await Promise.resolve();
    });

    it('does not submit the same annotation twice while the first save is pending', async () => {
        const { shadow, container } = createHost();
        const popover = new ReaderCommentPopover();
        let acknowledge: () => void = () => undefined;
        const onSave = vi.fn(() => new Promise<void>((resolve) => { acknowledge = resolve; }));
        popover.open({
            shadow, container,
            appearance: createAppearanceSnapshot('light'),
            mode: 'create', initialText: 'One note', selectedSource: 'Selected quote',
            anchorRect: { left: 180, top: 320, width: 120, height: 22, right: 300, bottom: 342 },
            labels: {}, onSave,
        });

        shadow.querySelector<HTMLButtonElement>('[data-action="save"]')!.click();
        shadow.querySelector<HTMLTextAreaElement>('[data-role="input"]')!
            .dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', metaKey: true, bubbles: true, cancelable: true }));
        expect(onSave).toHaveBeenCalledOnce();
        acknowledge();
        await vi.waitFor(() => expect(popover.isOpen()).toBe(false));
    });

    it('keeps deletion separate from discarding edits and requires explicit confirmation', async () => {
        const { shadow, container } = createHost();
        const popover = new ReaderCommentPopover();
        const onDelete = vi.fn();
        const onCancel = vi.fn();

        popover.open({
            shadow,
            container,
            appearance: createAppearanceSnapshot('light'),
            mode: 'edit',
            initialText: 'seed',
            selectedSource: 'seed source',
            anchorRect: {
                left: 180,
                top: 320,
                width: 120,
                height: 22,
                right: 300,
                bottom: 342,
            },
            labels: {},
            onSave: vi.fn(),
            onDelete,
            onCancel,
        } as any);

        const secondaryAction = shadow.querySelector<HTMLButtonElement>('[data-action="delete"]');
        expect(secondaryAction?.textContent).toBe('Delete');

        secondaryAction?.click();
        expect(onDelete).not.toHaveBeenCalled();
        shadow.querySelector<HTMLButtonElement>('[data-action="confirm-delete"]')!.click();
        expect(onDelete).toHaveBeenCalledTimes(1);
        expect(onCancel).not.toHaveBeenCalled();
    });

    it('keeps the edit popover open until deletion is acknowledged', async () => {
        const { shadow, container } = createHost();
        const popover = new ReaderCommentPopover();
        let acknowledge: () => void = () => undefined;
        const onDelete = vi.fn(() => new Promise<void>((resolve) => { acknowledge = resolve; }));
        popover.open({
            shadow, container,
            appearance: createAppearanceSnapshot('light'),
            mode: 'edit', initialText: 'Keep this note', selectedSource: 'Selected quote',
            anchorRect: { left: 180, top: 320, width: 120, height: 22, right: 300, bottom: 342 },
            labels: {}, onSave: vi.fn(), onDelete,
        });

        shadow.querySelector<HTMLButtonElement>('[data-action="delete"]')!.click();
        shadow.querySelector<HTMLButtonElement>('[data-action="confirm-delete"]')!.click();
        expect(onDelete).toHaveBeenCalledOnce();
        expect(popover.isOpen()).toBe(true);
        expect(shadow.querySelector<HTMLTextAreaElement>('[data-role="input"]')!.disabled).toBe(true);
        expect(shadow.querySelector<HTMLButtonElement>('[data-action="save"]')!.disabled).toBe(true);
        expect(shadow.querySelector<HTMLButtonElement>('[data-action="discard"]')!.disabled).toBe(true);
        acknowledge();
        await vi.waitFor(() => expect(popover.isOpen()).toBe(false));
    });

    it('keeps the annotation and allows retry when deletion fails', async () => {
        const { shadow, container } = createHost();
        const popover = new ReaderCommentPopover();
        const onDelete = vi.fn()
            .mockRejectedValueOnce(new Error('Storage unavailable'))
            .mockResolvedValueOnce(undefined);
        popover.open({
            shadow, container,
            appearance: createAppearanceSnapshot('light'),
            mode: 'edit', initialText: 'Keep this note', selectedSource: 'Selected quote',
            anchorRect: { left: 180, top: 320, width: 120, height: 22, right: 300, bottom: 342 },
            labels: {}, onSave: vi.fn(), onDelete,
        });

        shadow.querySelector<HTMLButtonElement>('[data-action="delete"]')!.click();
        const deleteButton = shadow.querySelector<HTMLButtonElement>('[data-action="confirm-delete"]')!;
        deleteButton.click();
        await vi.waitFor(() => expect(deleteButton.disabled).toBe(false));
        expect(popover.isOpen()).toBe(true);
        expect(shadow.querySelector<HTMLTextAreaElement>('[data-role="input"]')?.value).toBe('Keep this note');
        deleteButton.click();
        await vi.waitFor(() => expect(popover.isOpen()).toBe(false));
        expect(onDelete).toHaveBeenCalledTimes(2);
    });

    it('allows outside reading and returns focus only after explicit close discards unsaved input', async () => {
        const opener = document.createElement('button');
        document.body.appendChild(opener);
        opener.focus();
        const { shadow, container } = createHost();
        const popover = new ReaderCommentPopover();
        const onCancel = vi.fn();

        popover.open({
            shadow,
            container,
            appearance: createAppearanceSnapshot('light'),
            mode: 'create',
            initialText: 'seed',
            selectedSource: 'seed source',
            anchorRect: {
                left: 180,
                top: 320,
                width: 120,
                height: 22,
                right: 300,
                bottom: 342,
            },
            labels: {},
            onSave: vi.fn(),
            onCancel,
        } as any);

        const surface = shadow.querySelector<HTMLElement>('.reader-comment-popover');
        expect(surface?.dataset.aimdSurfaceProfile).toBe('anchored');
        expect(surface?.dataset.aimdRole).toBe('reader-comment-popover');

        document.body.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, composed: true }));
        expect(popover.isOpen()).toBe(true);
        document.body.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }));

        expect(onCancel).not.toHaveBeenCalled();
        expect(popover.isOpen()).toBe(true);
        shadow.querySelector<HTMLButtonElement>('[data-action="close"]')!.click();
        await vi.waitFor(() => expect(popover.isOpen()).toBe(false));
        expect(onCancel).toHaveBeenCalledTimes(1);
        expect(surface?.dataset.motionState).toBe('closing');

        surface?.dispatchEvent(new Event('animationend', { bubbles: true }));
        expect(document.activeElement).toBe(opener);
        expect(shadow.querySelector('.reader-comment-popover')).toBeNull();
    });

    it('keeps Escape inside an active IME composition and closes after composition ends', async () => {
        const { shadow, container } = createHost();
        const popover = new ReaderCommentPopover();
        const onCancel = vi.fn();

        popover.open({
            shadow,
            container,
            appearance: createAppearanceSnapshot('light'),
            mode: 'create',
            initialText: 'seed',
            selectedSource: 'seed source',
            anchorRect: {
                left: 180,
                top: 320,
                width: 120,
                height: 22,
                right: 300,
                bottom: 342,
            },
            labels: {},
            onSave: vi.fn(),
            onCancel,
        });

        const input = shadow.querySelector<HTMLTextAreaElement>('.reader-comment-popover__input')!;
        input.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true }));
        const composingEscape = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
        Object.defineProperty(composingEscape, 'isComposing', { value: false });
        input.dispatchEvent(composingEscape);
        expect(popover.isOpen()).toBe(true);
        expect(onCancel).not.toHaveBeenCalled();

        input.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true }));
        const escape = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
        Object.defineProperty(escape, 'isComposing', { value: false });
        input.dispatchEvent(escape);
        await vi.waitFor(() => expect(popover.isOpen()).toBe(false));
        expect(onCancel).toHaveBeenCalledTimes(1);
    });

    it('resets IME state between annotation sessions', async () => {
        const { shadow, container } = createHost();
        const popover = new ReaderCommentPopover();
        const open = (onCancel: () => void) => popover.open({
            shadow,
            container,
            appearance: createAppearanceSnapshot('light'),
            mode: 'create',
            initialText: 'seed',
            selectedSource: 'seed source',
            anchorRect: {
                left: 180,
                top: 320,
                width: 120,
                height: 22,
                right: 300,
                bottom: 342,
            },
            labels: {},
            onSave: vi.fn(),
            onCancel,
        });

        open(vi.fn());
        shadow.querySelector<HTMLTextAreaElement>('.reader-comment-popover__input')!
            .dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true }));
        popover.close(shadow, false);

        const onCancel = vi.fn();
        open(onCancel);
        const input = shadow.querySelector<HTMLTextAreaElement>('.reader-comment-popover__input')!;
        input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));

        await vi.waitFor(() => expect(popover.isOpen()).toBe(false));
        expect(onCancel).toHaveBeenCalledTimes(1);
    });

    it('updates active appearance and destroys all lifecycle work synchronously', () => {
        const { shadow, container } = createHost();
        const popover = new ReaderCommentPopover();
        const onCancel = vi.fn();

        popover.open({
            shadow,
            container,
            appearance: createAppearanceSnapshot('light'),
            mode: 'create',
            initialText: 'seed',
            selectedSource: 'seed source',
            anchorRect: {
                left: 180,
                top: 320,
                width: 120,
                height: 22,
                right: 300,
                bottom: 342,
            },
            labels: {},
            onSave: vi.fn(),
            onCancel,
        });

        popover.setAppearance(createAppearanceSnapshot('dark', { accentColor: '#2563eb' }));
        expect(shadow.querySelector('.reader-comment-popover')?.getAttribute('data-aimd-theme')).toBe('dark');

        popover.destroy();
        expect(popover.isOpen()).toBe(false);
        expect(shadow.querySelector('.reader-comment-popover')).toBeNull();

        document.body.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, composed: true }));
        document.body.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }));
        expect(onCancel).not.toHaveBeenCalled();
    });
});
