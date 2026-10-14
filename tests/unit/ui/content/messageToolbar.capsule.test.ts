import { afterEach, describe, expect, it, vi } from 'vitest';
import { MessageToolbar } from '@/ui/content/MessageToolbar';
import { setLocale } from '@/ui/content/components/i18n';

const mounted: MessageToolbar[] = [];
function mount(onClick = vi.fn(async () => ({ ok: true as const })), pinnedActions: readonly string[] = []) {
    const toolbar = new MessageToolbar('light', [{ id: 'copy', label: 'Copy', icon: '<svg/>', onClick }], { collapsible: true, showStats: true, pinnedActions });
    mounted.push(toolbar); document.body.append(toolbar.getElement());
    const shadow = toolbar.getElement().shadowRoot!;
    return { toolbar, shadow, toggle: shadow.querySelector<HTMLButtonElement>('[data-action="toggle-capsule"]')!, action: shadow.querySelector<HTMLButtonElement>('[data-action="copy"]')! };
}
afterEach(() => { mounted.splice(0).forEach(toolbar => { toolbar.dispose(); toolbar.getElement().remove(); }); vi.useRealTimers(); });

describe('message capsule entry', () => {
    it('keeps actions always visible without requiring hover or a click to expand', async () => {
        const { shadow, toggle, action } = mount();
        const host = shadow.host as HTMLElement;
        const drawer = shadow.querySelector<HTMLElement>('.capsule-actions')!;

        expect(host.dataset.expanded).toBe('true');
        expect(host.dataset.alwaysExpanded).toBe('1');
        expect(toggle.getAttribute('aria-expanded')).toBe('true');
        expect(toggle.hidden).toBe(true);
        expect(drawer.hasAttribute('inert')).toBe(false);
        expect(drawer.getAttribute('aria-hidden')).toBe('false');
        expect(action.isConnected).toBe(true);

        shadow.querySelector<HTMLElement>('.bar')!.dispatchEvent(new MouseEvent('mouseleave'));
        await Promise.resolve();
        expect(host.dataset.expanded).toBe('true');
        expect(drawer.hasAttribute('inert')).toBe(false);
    });

    it('exposes existing actions immediately and ignores Escape collapse', async () => {
        const click = vi.fn(async () => ({ ok: true as const }));
        const { shadow, toggle, action, toolbar } = mount(click);
        const drawer = shadow.querySelector<HTMLElement>('.capsule-actions')!;
        expect(drawer.hasAttribute('inert')).toBe(false);
        expect(toggle.getAttribute('aria-expanded')).toBe('true');
        toolbar.setStats(['128 Chars']);
        action.click(); await Promise.resolve();
        expect(click).toHaveBeenCalledOnce();
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
        expect(drawer.hasAttribute('inert')).toBe(false);
        expect(shadow.querySelector('[data-role="stats"]')?.textContent).toBe('128 Chars');
    });

    it('keeps an active operation alive and preserves an explicit disabled state', async () => {
        let complete!: (value: {ok: true}) => void;
        const click = vi.fn(() => new Promise<{ok: true}>(resolve => { complete = resolve; }));
        const { toolbar, action } = mount(click);
        action.click();
        document.body.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, composed: true }));
        expect((toolbar.getElement() as HTMLElement).dataset.expanded).toBe('true');
        toolbar.setActionDisabled('copy', true);
        complete({ok: true}); await Promise.resolve(); await Promise.resolve();
        expect(action.disabled).toBe(true);
        expect(click).toHaveBeenCalledOnce();
    });

    it('prefers website update time and omits unavailable time independently of statistics', () => {
        const { toolbar, shadow } = mount();
        const time = shadow.querySelector<HTMLTimeElement>('time')!;
        expect(time.hidden).toBe(true);
        toolbar.setMessageMetadata({ createdAt: 1700000000000, updatedAt: 1700000060000 });
        expect(time.hidden).toBe(false);
        expect(time.dateTime).toBe(new Date(1700000060000).toISOString());
        expect(time.textContent).not.toContain('2023');
        expect(time.textContent).toContain(' ');
        toolbar.setMessageMetadata({createdAt: 1700000000000});
        expect(time.dateTime).toBe(new Date(1700000000000).toISOString());
        toolbar.setMessageMetadata(null);
        expect(time.hidden).toBe(true);
        expect(time.textContent).toBe('');
    });

    it('formats message time with the selected Chinese or English interface language', async () => {
        const timestamp = new Date(2024, 10, 14, 9, 6).getTime();
        vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({}) })));
        const formatDate = vi.spyOn(Date.prototype, 'toLocaleDateString');
        const formatTime = vi.spyOn(Date.prototype, 'toLocaleTimeString');
        try {
            for (const [language, intlLocale] of [['zh_CN', 'zh-CN'], ['en', 'en-US']] as const) {
                await setLocale(language);
                const date = new Date(timestamp);
                const expected = `${date.toLocaleDateString(intlLocale, { month: '2-digit', day: '2-digit' })} ${date.toLocaleTimeString(intlLocale, { hour: '2-digit', minute: '2-digit', hour12: false })}`;
                formatDate.mockClear(); formatTime.mockClear();
                const { toolbar, shadow } = mount();
                toolbar.setMessageMetadata({ createdAt: timestamp });
                expect(shadow.querySelector('time')?.textContent).toBe(expected);
                expect(formatDate).toHaveBeenCalledWith(intlLocale, { month: '2-digit', day: '2-digit' });
                expect(formatTime).toHaveBeenCalledWith(intlLocale, { hour: '2-digit', minute: '2-digit', hour12: false });
            }
        } finally {
            await setLocale('auto');
            vi.unstubAllGlobals();
            formatDate.mockRestore(); formatTime.mockRestore();
        }
    });
});

describe('message action pins', () => {
    // Fork keeps the capsule always expanded, so pinnedActions stay in the
    // drawer rather than a collapsed pin strip. Still accept the option and
    // keep hover / click / tooltip working on the single action node.
    it('keeps pinned hover and focus independent while preserving its tooltip and click action', async () => {
        vi.useFakeTimers();
        const onClick = vi.fn(async () => ({ ok: true as const }));
        const { toolbar, shadow, toggle, action } = mount(onClick, ['copy']);
        const host = toolbar.getElement();
        const drawer = shadow.querySelector<HTMLElement>('.capsule-actions')!;
        vi.spyOn(action, 'getBoundingClientRect').mockReturnValue({ x: 100, y: 100, left: 100, top: 100, width: 24, height: 24, right: 124, bottom: 124, toJSON: () => ({}) } as DOMRect);

        expect(host.dataset.alwaysExpanded).toBe('1');
        expect(toggle.getAttribute('aria-expanded')).toBe('true');
        expect(drawer.hasAttribute('inert')).toBe(false);
        expect(action.closest('.capsule-actions')).toBeTruthy();

        action.dispatchEvent(new Event('pointerover', { bubbles: true, composed: true }));
        action.dispatchEvent(new MouseEvent('mouseenter'));
        action.focus();
        await vi.advanceTimersByTimeAsync(150);
        expect(document.querySelector('.aimd-tooltip')?.textContent).toBe('Copy');

        action.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, composed: true }));
        action.click();
        await Promise.resolve();
        expect(onClick).toHaveBeenCalledOnce();
        expect(toggle.getAttribute('aria-expanded')).toBe('true');
        expect(shadow.querySelectorAll('[data-action="copy"]')).toHaveLength(1);
    });

    it('uses the same action button once in the always-expanded drawer and keeps it clickable', async () => {
        const onClick=vi.fn(async()=>undefined);
        const toolbar=new MessageToolbar('light',[{id:'copy',label:'Copy',icon:'<svg/>',onClick},{id:'reader',label:'Reader',icon:'<svg/>',onClick:async()=>undefined}],{collapsible:true,pinnedActions:['copy'],showStats:true,showTimestamp:false});
        mounted.push(toolbar);document.body.append(toolbar.getElement());const shadow=toolbar.getElement().shadowRoot!;
        const host = toolbar.getElement();
        const button=shadow.querySelector<HTMLButtonElement>('[data-action="copy"]')!;
        expect(host.dataset.alwaysExpanded).toBe('1');
        expect(button.closest('[inert]')).toBeNull();
        expect(button.closest('.capsule-actions')).toBeTruthy();
        expect(shadow.querySelector('time')).toBeNull();
        button.click();await Promise.resolve();expect(onClick).toHaveBeenCalledOnce();
        shadow.querySelector<HTMLButtonElement>('[data-action="toggle-capsule"]')!.click();
        expect(button.closest('.capsule-actions')).toBeTruthy();
        expect(shadow.querySelectorAll('[data-action="copy"]')).toHaveLength(1);
        window.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape'}));
        expect(host.dataset.expanded).toBe('true');
        expect(button.closest('[inert]')).toBeNull();
    });
});
