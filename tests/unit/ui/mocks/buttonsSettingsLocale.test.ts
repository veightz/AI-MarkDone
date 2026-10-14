import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import browser from 'webextension-polyfill';

beforeEach(() => {
    vi.resetModules();
    vi.stubGlobal('browser', browser);
    vi.stubGlobal('fetch', vi.fn(async (url: unknown) => ({
        ok: true,
        json: async () => JSON.parse(fs.readFileSync(`public/${String(url).replace(/^\//, '')}`, 'utf8')),
    })));
    document.body.innerHTML = '<div id="app"></div>';
});
afterEach(() => {
    window.dispatchEvent(new Event('pagehide'));
    document.body.replaceChildren(); vi.unstubAllGlobals(); vi.restoreAllMocks();
});

it('changes every settings fixture surface to the requested locale', async () => {
    await import('../../../../mocks/components/buttons-settings/main');
    await window.__AIMD_VISUAL_HARNESS__!.applyVariant({ theme: 'dark', locale: 'en' });
    expect(document.documentElement.dataset.aimdTheme).toBe('dark');
    const transfer = document.querySelector('[data-role="settings-transfer"]')!.shadowRoot!;
    expect(transfer.querySelector('h3')?.textContent).toBe('Settings file');
    expect(transfer.querySelector('[data-action="settingsExport"]')?.textContent).toBe('Export settings');
    const buttons = document.querySelector('[data-role="settings-buttons"]')!.shadowRoot!;
    expect(buttons.querySelector('nav')?.getAttribute('aria-label')).toBe('Buttons');
});
