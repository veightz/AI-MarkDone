import layoutCss from './bookmarkSaveDialogLayout.css?inline';
import workspaceMaterials from '../ui/styles/workspaceMaterials.css?inline';
import { getModalHostShellCss } from '../../components/styles/modalHostCss';
import { getPanelChromeCss } from '../../components/styles/panelChromeCss';
import { getWorkflowDialogChromeCss } from '../../components/styles/workflowDialogChromeCss';

export function getBookmarkSaveDialogCss(): string {
    return `
:host {
  font-family: var(--aimd-font-family-sans);
}

*, *::before, *::after {
  box-sizing: border-box;
}

button, input, select, textarea {
  font: inherit;
  color: inherit;
}

${getPanelChromeCss()}
${getModalHostShellCss()}
${getWorkflowDialogChromeCss()}` + layoutCss + workspaceMaterials;
}
