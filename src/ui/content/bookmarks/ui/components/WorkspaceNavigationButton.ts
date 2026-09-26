import { createIcon } from '../../../components/Icon';
export function createWorkspaceNavigationButton(label: string, icon: string, onClick: () => void): HTMLButtonElement {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'library-type-button';
    button.setAttribute('aria-label', label);
    const text = document.createElement('span');
    text.className = 'workspace-navigation-label';
    text.textContent = label;
    button.append(createIcon(icon), text);
    button.addEventListener('click', onClick);
    return button;
}
