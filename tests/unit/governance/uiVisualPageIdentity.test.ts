import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readVisualPageIdentity } from '../../../scripts/ui-visual-page-identity';

beforeEach(() => {
    vi.spyOn(HTMLElement.prototype, 'getClientRects').mockReturnValue([
        { width: 200, height: 30 } as DOMRect,
    ] as unknown as DOMRectList);
});
afterEach(() => { document.body.replaceChildren(); vi.restoreAllMocks(); });

describe('visual page identity reads rendered content', () => {
    it('recognizes real controls inside nested Shadow DOM without light-DOM text', () => {
        const host = document.createElement('div');
        const nested = document.createElement('div');
        host.attachShadow({ mode: 'open' }).append(nested);
        nested.attachShadow({ mode: 'open' }).innerHTML = '<button>Export settings and review changes</button>';
        document.body.append(host);
        expect(readVisualPageIdentity().textLength).toBeGreaterThan(20);
    });
    it('does not count stylesheet, script, hidden or aria-hidden content as a working UI', () => {
        document.body.innerHTML = '<style>body { color: red; background: white; }</style><script>longScriptThatIsNotVisible()</script><div hidden>Hidden enough text to pass a naive probe</div><div aria-hidden="true">Decorative content is not useful UI</div><div style="display:none">Invisible enough text to pass a naive probe</div>';
        expect(readVisualPageIdentity().textLength).toBe(0);
    });
    it('keeps ordinary visible page content and framework errors detectable', () => {
        document.title = 'Fixture';
        document.body.innerHTML = '<main><button>Open the message export dialog</button></main><vite-error-overlay></vite-error-overlay>';
        expect(readVisualPageIdentity()).toMatchObject({ title: 'Fixture', viteOverlay: true });
        expect(readVisualPageIdentity().textLength).toBeGreaterThan(20);
    });
});
