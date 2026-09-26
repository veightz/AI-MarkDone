export type LibrarySelectionCommand = Readonly<{
    action: string;
    label: string;
    onClick: () => void | Promise<void>;
    disabled?: boolean;
    pressed?: boolean;
}>;

export type LibrarySelectionBarOptions = Readonly<{
    summary: string;
    scope?: LibrarySelectionCommand;
    selectPage: LibrarySelectionCommand;
    selectAll: LibrarySelectionCommand;
    invert: LibrarySelectionCommand;
    clear: LibrarySelectionCommand;
    actions?: readonly HTMLElement[];
    done: LibrarySelectionCommand;
}>;

function commandButton(command: LibrarySelectionCommand, extraClass = ''): HTMLButtonElement {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `secondary-btn library-selection-command${extraClass ? ` ${extraClass}` : ''}`;
    button.dataset.action = command.action;
    button.textContent = command.label;
    button.title = command.label;
    button.setAttribute('aria-label', command.label);
    if (typeof command.pressed === 'boolean') button.setAttribute('aria-pressed', String(command.pressed));
    button.disabled = Boolean(command.disabled);
    button.addEventListener('click', async (event) => {
        event.preventDefault();
        event.stopPropagation();
        if (button.disabled) return;
        button.disabled = true;
        try {
            await command.onClick();
        } finally {
            if (button.isConnected) button.disabled = false;
        }
    });
    return button;
}

/** Shared selection grammar for bookmarks, highlights, and annotations. */
export function renderLibrarySelectionBar(container: HTMLElement, options: LibrarySelectionBarOptions): void {
    const root = container.getRootNode();
    const active = root instanceof ShadowRoot ? root.activeElement : document.activeElement;
    const activeAction = active instanceof HTMLElement && container.contains(active) ? active.dataset.action : undefined;
    container.classList.add('library-selection-bar');
    container.replaceChildren();

    const summary = document.createElement('span');
    summary.className = 'library-selection-summary';
    summary.setAttribute('aria-live', 'polite');
    summary.textContent = options.summary;
    container.append(summary);

    if (options.scope) {
        container.append(commandButton(options.scope, 'library-selection-scope-button'));
    }

    const controls = document.createElement('div');
    controls.className = 'library-selection-controls';
    controls.append(
        commandButton(options.selectPage),
        commandButton(options.selectAll),
        commandButton(options.invert),
        commandButton(options.clear),
    );
    container.append(controls);

    if (options.actions?.length) {
        const actions = document.createElement('div');
        actions.className = 'library-selection-type-actions';
        actions.append(...options.actions);
        container.append(actions);
    }

    container.append(commandButton(options.done, 'library-selection-done'));
    if (activeAction && !container.hidden) {
        const replacement = [...container.querySelectorAll<HTMLButtonElement>('[data-action]')]
            .find(button => button.dataset.action === activeAction && !button.disabled);
        replacement?.focus({ preventScroll: true });
    }
}
