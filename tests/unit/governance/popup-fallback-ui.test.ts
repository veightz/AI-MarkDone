import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createPopupPreviewHtml } from '../../../mocks/components/unsupported-popup/popupPreview';

function readPopupHtml(): string {
    return readFileSync(resolve(process.cwd(), 'src/popup/popup.html'), 'utf-8');
}

function readLocaleMessages(locale: 'en' | 'zh_CN'): Record<string, { message?: string }> {
    return JSON.parse(
        readFileSync(resolve(process.cwd(), `public/_locales/${locale}/messages.json`), 'utf-8'),
    );
}

afterEach(() => {
    vi.unstubAllGlobals();
    document.body.innerHTML = '';
    document.documentElement.removeAttribute('data-aimd-theme');
    document.documentElement.removeAttribute('style');
});

describe('fallback popup UI', () => {
    it('keeps the real popup preview API executable and preserves catalog text', () => {
        const catalog = { popupSupportedSites: { message: '支持的网站' }, literal: { message: 'literal </script> text' } };
        const servedHtml = '<html><head><script type="module" src="/@vite/client"></script><link rel="stylesheet" href="/src/popup/popup-tokens.css" /></head><body><script type="module" src="/src/popup/popup.js?t=123"></script></body></html>';
        const markup = createPopupPreviewHtml(servedHtml, catalog, 'zh-CN', ':root { color-scheme: dark; }');
        const parsed = new DOMParser().parseFromString(markup, 'text/html');
        expect(parsed.scripts).toHaveLength(3);
        const runtime: { browser?: { i18n: { getMessage: (key: string) => string }; runtime: { getURL: (path: string) => string } } } = {};
        new Function('globalThis', parsed.querySelector('script:not([src])')?.textContent ?? '')(runtime);
        expect(runtime.browser?.i18n.getMessage('popupSupportedSites')).toBe('支持的网站');
        expect(runtime.browser?.i18n.getMessage('literal')).toBe('literal </script> text');
        expect(runtime.browser?.runtime.getURL('/icons/icon48.png')).toBe('/icons/icon48.png');
    });

    it('honors explicit appearance and valid custom accent without a second swatch list', () => {
        const script = readFileSync(resolve(process.cwd(), 'src/popup/popup.js'), 'utf-8');
        vi.stubGlobal('matchMedia', () => ({ matches: false, addEventListener: vi.fn() }));
        vi.stubGlobal('browser', {
            storage: { sync: { get: (_key: string, callback: (value: unknown) => void) => callback({
                app_settings: { appearance: { themeMode: 'dark', accentColor: '#0f766e', fontSizePx: 18 } },
            }) } },
        });
        new Function(script)();
        expect(document.documentElement.dataset.aimdTheme).toBe('dark');
        expect(document.documentElement.style.getPropertyValue('--aimd-interactive-primary')).toBe('#0f766e');
    });

    it('uses a build-generated stylesheet from the canonical token and material sources', () => {
        const html = readPopupHtml();
        const prepare = readFileSync(resolve(process.cwd(), 'scripts/prepare-extension-target.ts'), 'utf-8');
        expect(html).toContain('/src/popup/popup-tokens.css');
        expect(html).not.toMatch(/--aimd-[\w-]+:\s*(?:#[\da-f]+|rgba?\()/i);
        expect(prepare).toContain('getPageTokenCss()');
        expect(prepare).toContain('getSurfaceMaterialCss()');
    });
    it('keeps the unsupported-site popup on the tokenized card layout instead of a bare link list', () => {
        const html = readPopupHtml();

        expect(html).toContain('class="popup-shell aimd-material-surface"');
        expect(html).toContain('class="popup-header"');
        expect(html).toContain('class="popup-links"');
        expect(html).toContain('class="popup-link aimd-material-button"');
        expect(html).toContain('class="popup-footer"');
        expect(html).toContain('--aimd-');
    });

    it.each(['red;display:none', 'url(https://example.com)', '#12345', 'transparent'])('rejects unsafe or invalid accent %s', accentColor => {
        const script = readFileSync(resolve(process.cwd(), 'src/popup/popup.js'), 'utf-8');
        vi.stubGlobal('browser', { storage: { sync: { get: (_key: string, callback: (value: unknown) => void) => callback({
            app_settings: { appearance: { accentColor } },
        }) } } });
        new Function(script)();
        expect(document.documentElement.style.getPropertyValue('--aimd-interactive-primary')).toBe('');
    });

    it('keeps popup JavaScript external so extension CSP does not need unsafe-inline', () => {
        const html = readPopupHtml();

        expect(html).toContain('<script src="/src/popup/popup.js"></script>');
        expect(html).not.toMatch(/<script\b(?![^>]*\bsrc=)[^>]*>/i);
    });

    it('links to ChatGPT plus formula copy hosts from the unsupported-site popup', () => {
        const html = readPopupHtml();

        expect(html).toContain('href="https://chatgpt.com/"');
        expect(html).toContain('href="https://gemini.google.com/"');
        expect(html).toContain('href="https://claude.ai/"');
        expect(html).toContain('href="https://chat.deepseek.com/"');
        expect(html).toContain('Formula copy');
        expect(html).toContain('Open ChatGPT and use the toolbar below a reply.');
    });

    it('localizes every user-facing popup label through extension i18n', () => {
        const html = readPopupHtml();
        const script = readFileSync(resolve(process.cwd(), 'src/popup/popup.js'), 'utf-8');

        expect(html).toContain('data-i18n="popupSupportedSites"');
        expect(html).toContain('data-i18n="popupChatGptHint"');
        expect(html).toContain('data-i18n="popupFormulaCopyHint"');
        expect(html).toContain('data-i18n="popupUnsupportedPageFooter"');
        expect(html).toContain('data-i18n-attr="alt:popupLogoAlt"');
        expect(script).toContain('i18n.getMessage');
        expect(script).toContain("document.documentElement.lang");
    });

    it('honors the saved language instead of always using the browser UI language', async () => {
        const script = readFileSync(resolve(process.cwd(), 'src/popup/popup.js'), 'utf-8');
        const en = readLocaleMessages('en');
        const zh = readLocaleMessages('zh_CN');
        const stored = {
            app_settings: {
                language: 'zh_CN',
                appearance: {},
            },
        };

        document.body.innerHTML = `
            <div data-i18n="popupSupportedSites">Supported sites</div>
            <img data-i18n-attr="alt:popupLogoAlt" alt="AI-MarkDone logo">
        `;
        vi.stubGlobal('browser', {
            i18n: {
                getMessage: (key: string) => en[key]?.message ?? '',
                getUILanguage: () => 'en',
            },
            runtime: {
                getURL: (path: string) => path,
            },
            storage: {
                sync: {
                    get: (_key: string, callback: (value: typeof stored) => void) => {
                        callback(stored);
                        return Promise.resolve(stored);
                    },
                },
            },
        });
        vi.stubGlobal(
            'fetch',
            vi.fn(async (url: string) => ({
                ok: String(url).includes('_locales/zh_CN/messages.json'),
                json: async () => zh,
            })),
        );

        new Function(script)();

        await vi.waitFor(() => {
            expect(document.querySelector('[data-i18n]')?.textContent).toBe('支持的网站');
        });
        expect(document.querySelector('img')?.getAttribute('alt')).toBe('AI-MarkDone 标志');
        expect(document.documentElement.lang).toBe('zh-CN');
    });

    it('keeps the popup usable at the documented 320px minimum width', () => {
        const html = readPopupHtml();

        expect(html).toContain('min-width: 320px');
        expect(html).toContain('@media (max-width: 360px)');
        expect(html).toContain('overflow-wrap: anywhere');
    });

    it('follows the browser color scheme without requiring the host page theme runtime', () => {
        const html = readPopupHtml();
        const script = readFileSync(resolve(process.cwd(), 'src/popup/popup.js'), 'utf-8');

        expect(html).toContain(':root[data-aimd-theme="dark"]');
        expect(script).toContain('globalThis.matchMedia');
        expect(script).toContain('(prefers-color-scheme: dark)');
        expect(script).toContain("data-aimd-theme");
    });
});
