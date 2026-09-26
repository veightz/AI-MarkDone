import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

import { createBookmarksPanelShell } from '@/ui/content/bookmarks/ui/BookmarksPanelShell';
import { getBookmarksPanelCss } from '@/ui/content/bookmarks/ui/styles/bookmarksPanelCss';

describe('BookmarksPanelShell', () => {
    it('keeps information destinations visible and clears the category selection through the actual tab trigger', () => {
        const navigation = document.createElement('div');
        navigation.innerHTML = '<button data-category="reading" data-active="true" aria-pressed="true">Reading</button>';
        const shell = createBookmarksPanelShell({titleText:'Library',closeIcon:'<svg/>',closeLabel:'Close',defaultTabId:'settings',tabs:[
            {id:'bookmarks',label:'Library',icon:'<svg/>',content:document.createElement('div')},
            {id:'settings',label:'Settings',icon:'<svg/>',content:document.createElement('div'),navigation},
            {id:'about',label:'About',icon:'<svg/>',content:document.createElement('div')},
        ]});
        const about = shell.panel.querySelector<HTMLButtonElement>('[data-tab-id="about"]')!;
        expect(about.closest('details')).toBeNull();
        about.click();
        expect(navigation.firstElementChild?.getAttribute('aria-pressed')).toBe('false');
        expect(about.getAttribute('aria-pressed')).toBe('true');
    });
    it('fills the available panel height and keeps bulk controls hidden until requested', () => {
        const css = getBookmarksPanelCss();
        expect(css).toMatch(/\.bookmarks-shell\s*\{[^}]*flex:\s*1;/);
        expect(css).toContain('.batch-bar[hidden]');
    });
    it('creates dedicated header meta and actions wrappers instead of overloading the header element', () => {
        const content = document.createElement('div');
        const shell = createBookmarksPanelShell({
            titleText: 'Bookmarks',
            closeIcon: '<svg></svg>',
            closeLabel: 'Close',
            tabs: [
                {
                    id: 'bookmarks',
                    label: 'Bookmarks',
                    icon: '<svg></svg>',
                    content,
                },
            ],
            defaultTabId: 'bookmarks',
        });

        const header = shell.panel.querySelector('.panel-header');
        const meta = shell.panel.querySelector('.panel-header__meta');
        const actions = shell.panel.querySelector('.panel-header__actions');
        const title = shell.panel.querySelector('.panel-header__meta h2');

        expect(header).toBeTruthy();
        expect(meta).toBeTruthy();
        expect(actions).toBeTruthy();
        expect(header?.classList.contains('panel-header__meta')).toBe(false);
        expect(header?.classList.contains('panel-header__actions')).toBe(false);
        expect(meta?.contains(shell.title)).toBe(true);
        expect(actions?.contains(shell.closeBtn)).toBe(true);
        expect(title?.textContent).toBe('Bookmarks');
    });

    it('uses the mock shell structure with sidebar tab buttons and tab panels instead of the legacy Tabs component DOM', () => {
        const bookmarks = document.createElement('div');
        const settings = document.createElement('div');
        const shell = createBookmarksPanelShell({
            titleText: 'Bookmarks',
            closeIcon: '<svg></svg>',
            closeLabel: 'Close',
            tabs: [
                {
                    id: 'bookmarks',
                    label: 'Bookmarks',
                    icon: '<svg></svg>',
                    content: bookmarks,
                    panelClassName: 'tab-panel--bookmarks',
                },
                {
                    id: 'settings',
                    label: 'Settings',
                    icon: '<svg></svg>',
                    content: settings,
                    panelClassName: 'settings-panel',
                },
            ],
            defaultTabId: 'bookmarks',
        });

        const root = shell.tabs.getElement();
        const sidebar = root.querySelector('.bookmarks-sidebar');
        const body = root.querySelector('.bookmarks-body');
        const buttons = root.querySelectorAll('.tab-btn');
        const panels = root.querySelectorAll('.tab-panel');

        expect(root.classList.contains('bookmarks-shell')).toBe(true);
        expect(root.querySelector('.aimd-tabs')).toBeFalsy();
        expect(sidebar).toBeTruthy();
        expect(body).toBeTruthy();
        expect(buttons).toHaveLength(2);
        expect(panels).toHaveLength(2);
        expect(bookmarks.dataset.active).toBe('1');
        expect(settings.dataset.active).toBe('0');

        shell.tabs.setActive('settings');

        expect(bookmarks.dataset.active).toBe('0');
        expect(settings.dataset.active).toBe('1');
    });

    it('switches through module buttons without replacing navigation or panels', () => {
        const navigation = document.createElement('div');
        const content = document.createElement('div');
        const shell = createBookmarksPanelShell({ titleText: 'Library', closeIcon: '<svg/>', closeLabel: 'Close', defaultTabId: 'bookmarks', tabs: [
            { id: 'bookmarks', label: 'Library', icon: '<svg/>', content, navigation },
            { id: 'settings', label: 'Settings', icon: '<svg/>', content: document.createElement('div') },
        ] });
        const libraryNav = shell.panel.querySelector('#aimd-library-navigation')!;
        const settingsButton = shell.panel.querySelector<HTMLButtonElement>('[data-tab-id="settings"]')!;
        settingsButton.click();
        expect(libraryNav.hasAttribute('inert')).toBe(true);
        expect(settingsButton.getAttribute('aria-expanded')).toBe('true');
        shell.panel.querySelector<HTMLButtonElement>('[data-tab-id="bookmarks"]')!.click();
        expect(libraryNav.firstElementChild).toBe(navigation);
        expect(libraryNav.hasAttribute('inert')).toBe(false);
        expect(content.parentElement?.hidden).toBe(false);
        expect(getBookmarksPanelCss()).toContain('prefers-reduced-motion');
    });

    it('is the only shell source of truth used by BookmarksPanel', () => {
        const source = fs.readFileSync(
            path.join(process.cwd(), 'src/ui/content/bookmarks/BookmarksPanel.ts'),
            'utf8',
        );

        expect(source).toContain('createBookmarksPanelShell');
        expect(source).not.toContain('function getPanelHtml(');
        expect(source).not.toContain('getPanelHtml(');
    });
});
