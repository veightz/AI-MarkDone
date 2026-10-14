export function createPopupPreviewHtml(
    html: string,
    catalog: Record<string, { message?: string }>,
    locale: string,
    appearanceCss: string,
): string {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const entry = doc.querySelector('script[src*="/src/popup/popup.js"]');
    const link = doc.querySelector('link[href*="/src/popup/popup-tokens.css"]');
    if (!entry || !link) throw new Error('Shipped popup entry or appearance stylesheet is missing.');
    const style = doc.createElement('style');
    style.textContent = appearanceCss;
    link.replaceWith(style);

    const bootstrap = doc.createElement('script');
    const serializedCatalog = JSON.stringify(catalog).replaceAll('<', '\\u003c');
    bootstrap.textContent = `(() => {
      const catalog = ${serializedCatalog};
      const api = {
        runtime: { id: 'aimd-popup-visual', getURL: path => '/' + (path.startsWith('/') ? path.slice(1) : path) },
        i18n: { getMessage: key => catalog[key]?.message || '', getUILanguage: () => ${JSON.stringify(locale)} },
        storage: { sync: { get: (_key, callback) => { const value = {}; callback?.(value); return Promise.resolve(value); } } }
      };
      globalThis.browser = api;
      globalThis.chrome = api;
    })();`;
    entry.before(bootstrap);
    return '<!doctype html>' + doc.documentElement.outerHTML;
}
