import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import browser from 'webextension-polyfill';
const scrollIntoViewDescriptor = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'scrollIntoView');

beforeEach(() => {
    vi.resetModules();
    vi.stubGlobal('browser', browser);
    vi.stubGlobal('fetch', vi.fn(async (url: unknown) => ({
        ok: true,
        json: async () => JSON.parse(fs.readFileSync(`public/${String(url).replace(/^\//, '')}`, 'utf8')),
    })));
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: vi.fn() });
    // This fixture gate checks readiness and confirmation; jsdom has no visible focus geometry.
    vi.spyOn(HTMLElement.prototype, 'focus').mockImplementation(() => undefined);
    const html = fs.readFileSync('mocks/components/bookmarks-workspace/index.html', 'utf8');
    document.body.innerHTML = html.match(/<body>([\s\S]*?)<script type="module"/)![1]!;
});

afterEach(() => {
    window.dispatchEvent(new Event('pagehide'));
    document.body.replaceChildren();
    window.history.replaceState({}, '', '/');
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    if (scrollIntoViewDescriptor) Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', scrollIntoViewDescriptor);
    else Reflect.deleteProperty(HTMLElement.prototype, 'scrollIntoView');
});

describe('bookmarks workspace settings transfer fixtures', () => {
    it.each([
        ['settings-transfer-preview', 'settingsImportConfirm'],
        ['settings-transfer-export', 'settingsExportConfirm'],
    ])('opens %s through the enabled production control and stops at confirmation', async (view, action) => {
        window.history.replaceState({}, '', `/?view=${view}&theme=dark&locale=zh_CN`);
        await import('../../../../mocks/components/bookmarks-workspace/main');
        const root = document.getElementById('aimd-bookmarks-panel-host')!.shadowRoot!;
        const transfer = root.querySelector<HTMLElement>('[data-role="settings-transfer"]')!.shadowRoot!;
        const confirm = transfer.querySelector<HTMLButtonElement>(`[data-action="${action}"]`);
        expect(confirm).toBeTruthy();
        expect(confirm?.disabled).toBe(false);
        expect(transfer.querySelector('[data-kind="compatibility"]')).toBeNull();
        const result = await (browser.runtime.sendMessage as any)({ v: 1, id: 'no-write', type: 'settings:applyImport', payload: {} });
        expect(result).toMatchObject({ ok: false, error: { code: 'VISUAL_PREVIEW_ONLY' } });
        transfer.querySelector<HTMLButtonElement>('[data-action="btnCancel"]')!.click();
        expect(transfer.querySelector(`[data-action="${action}"]`)).toBeNull();
    });
});
