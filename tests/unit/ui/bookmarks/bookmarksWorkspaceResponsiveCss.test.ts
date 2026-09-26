import { describe, expect, it } from 'vitest';
import { getBookmarksPanelCss } from '@/ui/content/bookmarks/ui/styles/bookmarksPanelCss';
import { getBookmarksWorkspaceResponsiveCss } from '@/ui/content/bookmarks/ui/styles/bookmarksWorkspaceResponsiveCss';

describe('Bookmarks workspace responsive family styles', () => {
    it('owns the workspace 980/720/560 contracts and composes them into the shipped family stylesheet', () => {
        const responsiveCss = getBookmarksWorkspaceResponsiveCss();
        const shippedCss = getBookmarksPanelCss();

        expect(responsiveCss).toContain('@media (max-width: 980px)');
        expect(responsiveCss).toContain('@media (max-width: 720px)');
        expect(responsiveCss).toContain('@media (max-width: 560px)');
        expect(shippedCss).toContain('.library-sidebar-modules');
        expect(responsiveCss).toContain('.settings-panel-scroll');
        expect(responsiveCss).toContain('.settings-row');
        expect(shippedCss).toContain(responsiveCss.trim());
    });

    it('keeps row actions in a click menu at narrow widths and respects reduced motion', () => {
        const css = getBookmarksPanelCss();
        expect(css).toContain('@media (max-width: 760px)');
        expect(css).toContain('.library-more>summary');
        expect(css).toContain('.library-menu-items { position: fixed;');
        expect(css).toContain('.library-record-copy { flex: 1; min-width: 0;');
        expect(css).toContain('@media (prefers-reduced-motion: reduce)');
        expect(css).not.toContain('.tree-item:hover .tree-actions');
    });

    it('keeps community QR codes large and stacks them into one scan-friendly column on narrow layouts', () => {
        const responsiveCss = getBookmarksWorkspaceResponsiveCss();
        const shippedCss = getBookmarksPanelCss();

        expect(shippedCss).toMatch(/\.community-group-card__image-frame\s*\{[\s\S]*?aspect-ratio: 9 \/ 16;/);
        expect(shippedCss).toMatch(/\.community-group-card__image\s*\{[\s\S]*?object-fit: contain;/);
        expect(shippedCss).toMatch(/@media \(max-width: 720px\)[\s\S]*?\.community-group-grid\s*\{[\s\S]*?grid-template-columns: 1fr;/);
        expect(responsiveCss).toMatch(/@media \(max-width: 560px\)[\s\S]*?\.community-card\s*\{[\s\S]*?padding: var\(--aimd-space-4\);/);
    });
});
