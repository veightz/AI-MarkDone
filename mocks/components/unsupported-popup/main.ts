import {
    installVisualHarnessBridge,
    type VisualHarnessVariant,
} from '../visualHarnessBridge';
import { getPageTokenCss } from '../../../src/style/tokens';
import { getSurfaceMaterialCss } from '../../../src/ui/content/components/styles/surfaceMaterialCss';
import { createPopupPreviewHtml } from './popupPreview';

const frame = document.getElementById('popup-frame') as HTMLIFrameElement;
let variant: VisualHarnessVariant = { theme: 'light', locale: 'en' };

async function loadCatalog(locale: VisualHarnessVariant['locale']): Promise<Record<string, { message?: string }>> {
    const response = await fetch(`/_locales/${locale}/messages.json`);
    if (!response.ok) throw new Error(`Unable to load ${locale} popup catalog`);
    return await response.json() as Record<string, { message?: string }>;
}

async function renderPopup(next: VisualHarnessVariant): Promise<void> {
    variant = next;
    document.documentElement.dataset.aimdTheme = next.theme;
    document.body.dataset.theme = next.theme;
    const [htmlResponse, catalog] = await Promise.all([
        fetch('/src/popup/popup.html'),
        loadCatalog(next.locale),
    ]);
    if (!htmlResponse.ok) throw new Error('Unable to load the shipped popup document');
    const popupHtml = await htmlResponse.text();
    const locale = next.locale === 'zh_CN' ? 'zh-CN' : 'en';
    frame.srcdoc = createPopupPreviewHtml(popupHtml, catalog, locale, [getPageTokenCss(), getSurfaceMaterialCss()].join('\n'));
    await new Promise<void>((resolve) => frame.addEventListener('load', () => resolve(), { once: true }));
    const root = frame.contentDocument?.documentElement;
    if (root) {
        root.dataset.aimdTheme = next.theme;
        root.lang = locale;
    }
}

await renderPopup(variant);

installVisualHarnessBridge({
    applyVariant: renderPopup,
    prepareForAudit: () => frame.scrollIntoView({ block: 'start', inline: 'nearest' }),
    getState: () => ({
        ...variant,
        expectedOpenSurfaces: [],
        localeEvidence: frame.contentDocument?.body.innerText ?? '',
    }),
});
