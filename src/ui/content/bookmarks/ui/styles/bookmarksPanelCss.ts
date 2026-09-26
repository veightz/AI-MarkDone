import layoutCss from './bookmarksPanelLayout.css?inline';
import workspaceMaterials from './workspaceMaterials.css?inline';
import { getLibraryWorkspaceCss } from './libraryWorkspaceCss';
import { getInputFieldCss } from '../../../components/styles/inputFieldCss';
import { getPanelChromeCss } from '../../../components/styles/panelChromeCss';
import { getBookmarksWorkspaceResponsiveCss } from './bookmarksWorkspaceResponsiveCss';

export function getBookmarksPanelCss(): string {
    return `
:host {
  font-family: var(--aimd-font-family-sans);
  --_bookmarks-panel-edge-offset: var(--aimd-space-6);
  --_bookmarks-panel-edge-offset-mobile: calc(var(--aimd-space-3) + var(--aimd-space-4));
  --_bookmarks-sidebar-gap: var(--aimd-space-2);
  --_bookmarks-control-height: 44px;
  --_bookmarks-control-surface: color-mix(in srgb, var(--aimd-bg-surface) 94%, var(--aimd-bg-primary));
  --_bookmarks-control-border: color-mix(in srgb, var(--aimd-border-strong) 74%, transparent);
  --_bookmarks-control-inset-effect: inset 0 1px 0 color-mix(in srgb, var(--aimd-interactive-hover) 82%, transparent);
  --_bookmarks-card-radius: calc(var(--aimd-radius-2xl) + var(--aimd-space-1));
  --_bookmarks-card-radius-lg: calc(var(--aimd-radius-2xl) + var(--aimd-space-2) / 2);
  --_bookmarks-card-radius-xl: calc(var(--aimd-radius-2xl) + var(--aimd-space-3) / 2);
  --_bookmarks-inline-menu-z: var(--aimd-z-tooltip);
  --_bookmarks-batch-z: calc(calc(var(--aimd-z-base) + 1) + 1);
}
* { box-sizing: border-box; }
button,
input,
select,
textarea { font-family: inherit; font-size: inherit; line-height: inherit; color: inherit; }
button { cursor: pointer; }
${getInputFieldCss()}
${getPanelChromeCss()}

${layoutCss}
${getBookmarksWorkspaceResponsiveCss()}
${getLibraryWorkspaceCss()}
${workspaceMaterials}
`;
}
