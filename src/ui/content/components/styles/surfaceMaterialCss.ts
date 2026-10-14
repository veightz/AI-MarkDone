/**
 * Shared UI materials. Surface owners keep geometry, scrolling and lifecycle;
 * these semantic classes only control appearance and native control states.
 * Append after feature layout CSS so an entry point cannot change the material.
 */
export function getSurfaceMaterialCss(): string {
    return `
:is(.aimd-material-surface, .panel-window, .mock-modal, .library-menu-items, .settings-select-menu) {
  color: var(--aimd-text-primary);
  background: var(--aimd-workspace-card);
  border: 1px solid var(--aimd-workspace-border);
  border-radius: var(--aimd-radius-2xl);
  box-shadow: var(--aimd-shadow-lg), var(--aimd-workspace-edge-shadow);
}

:is(.aimd-material-chrome, .panel-header, .panel-footer, .mock-modal__head, .mock-modal__footer) {
  background: var(--aimd-workspace-surface);
  border-color: var(--aimd-workspace-border);
}

.aimd-material-card {
  color: var(--aimd-text-primary);
  background: var(--aimd-workspace-card);
  border: 1px solid var(--aimd-workspace-border);
  border-radius: var(--aimd-radius-xl);
}

:is(.aimd-material-field, .aimd-field-shell, .aimd-field-control--standalone, .mock-modal__input, .search-field, .library-annotation-editor) {
  color: var(--aimd-text-primary);
  background: var(--aimd-workspace-surface);
  border: 1px solid var(--aimd-workspace-border);
  border-radius: var(--aimd-radius-xl);
  box-shadow: var(--aimd-workspace-inset);
}

:is(.aimd-material-field, .aimd-field-shell, .search-field):focus-within,
:is(.aimd-material-field, .aimd-field-control--standalone, .mock-modal__input, .library-annotation-editor):focus-visible {
  border-color: var(--aimd-focus-ring);
  outline: 2px solid color-mix(in srgb, var(--aimd-interactive-primary) 72%, var(--aimd-text-primary));
  outline-offset: 2px;
  box-shadow: var(--aimd-workspace-inset);
}

:is(.aimd-material-field, .aimd-field-control--standalone)::placeholder {
  color: var(--aimd-text-secondary);
}

:is(.aimd-material-button, .panel-secondary-btn, .secondary-btn, .primary-btn, .mock-modal__button, .settings-select-trigger, .settings-stepper-field) {
  color: var(--aimd-text-primary);
  background: var(--aimd-workspace-card);
  border: 1px solid var(--aimd-workspace-border);
  border-radius: var(--aimd-radius-xl);
  box-shadow: var(--aimd-workspace-raised);
  transition: background var(--aimd-duration-fast) var(--aimd-ease-in-out),
    border-color var(--aimd-duration-fast) var(--aimd-ease-in-out),
    color var(--aimd-duration-fast) var(--aimd-ease-in-out),
    box-shadow var(--aimd-duration-fast) var(--aimd-ease-in-out);
}

:is(.aimd-material-button, .panel-secondary-btn, .secondary-btn, .primary-btn, .mock-modal__button, .settings-select-trigger):hover:not(:disabled):not([aria-disabled="true"]) {
  background: var(--aimd-workspace-surface);
}

:is(.aimd-material-button, .panel-secondary-btn, .secondary-btn, .primary-btn, .mock-modal__button, .settings-select-trigger):active:not(:disabled):not([aria-disabled="true"]) {
  box-shadow: var(--aimd-workspace-inset);
}

:is(.aimd-material-button--primary, .panel-secondary-btn--primary, .secondary-btn--primary, .primary-btn, .mock-modal__button--primary) {
  color: var(--aimd-text-on-primary);
  background: var(--aimd-interactive-primary);
  border-color: var(--aimd-interactive-primary);
}

:is(.aimd-material-button--primary, .panel-secondary-btn--primary, .secondary-btn--primary, .primary-btn, .mock-modal__button--primary):hover:not(:disabled):not([aria-disabled="true"]) {
  color: var(--aimd-text-on-primary);
  background: var(--aimd-interactive-primary-hover);
  border-color: var(--aimd-interactive-primary-hover);
}

:is(.aimd-material-button--quiet, .panel-secondary-btn--ghost, .secondary-btn--ghost) {
  color: var(--aimd-text-secondary);
  background: transparent;
  border-color: transparent;
  box-shadow: none;
}

:is(.aimd-material-button--quiet, .panel-secondary-btn--ghost, .secondary-btn--ghost):hover:not(:disabled):not([aria-disabled="true"]) {
  color: var(--aimd-text-primary);
  background: var(--aimd-interactive-hover);
  box-shadow: none;
}

:is(.aimd-material-button--danger, .panel-secondary-btn--danger, .secondary-btn--danger, .mock-modal__button--danger) {
  color: var(--aimd-interactive-danger);
}

:is(.aimd-material-button--danger, .panel-secondary-btn--danger, .secondary-btn--danger, .mock-modal__button--danger):hover:not(:disabled):not([aria-disabled="true"]) {
  color: var(--aimd-interactive-danger);
  background: var(--aimd-feedback-danger-bg);
}

:is(.aimd-material-button, .panel-secondary-btn, .secondary-btn, .primary-btn, .mock-modal__button, .settings-select-trigger):focus-visible,
:is(.panel-icon-btn, .icon-btn, .panel-nav-btn, .nav-btn, .mock-modal__close):focus-visible,
.aimd-material-choice:focus-visible,
.aimd-material-check:focus-visible {
  outline: 2px solid color-mix(in srgb, var(--aimd-interactive-primary) 72%, var(--aimd-text-primary));
  outline-offset: 2px;
}

:is(.aimd-material-button, .panel-secondary-btn, .secondary-btn, .primary-btn, .mock-modal__button, .aimd-material-field, .aimd-material-choice):is(:disabled, [aria-disabled="true"]) {
  opacity: var(--aimd-opacity-disabled);
  cursor: not-allowed;
}

.aimd-material-segmented {
  background: var(--aimd-workspace-surface);
  border: 1px solid var(--aimd-workspace-border);
  border-radius: var(--aimd-radius-xl);
  box-shadow: var(--aimd-workspace-inset);
}

.aimd-material-choice {
  color: var(--aimd-text-primary);
  background: transparent;
  border: 1px solid transparent;
  border-radius: var(--aimd-radius-lg);
  box-shadow: none;
}

.aimd-material-choice:hover:not(:disabled):not([aria-disabled="true"]) {
  background: var(--aimd-interactive-hover);
}

.aimd-material-choice:is([aria-pressed="true"], [aria-checked="true"], [aria-selected="true"], [data-active="1"], [data-selected="1"]) {
  color: var(--aimd-text-primary);
  background: var(--aimd-interactive-selected);
  border-color: transparent;
  box-shadow: var(--aimd-workspace-edge-shadow);
}

.aimd-material-check {
  accent-color: var(--aimd-interactive-primary);
}

@media (prefers-reduced-motion: reduce) {
  :is(.aimd-material-button, .panel-secondary-btn, .secondary-btn, .primary-btn, .mock-modal__button, .settings-select-trigger) {
    transition: none;
  }
}
`;
}
