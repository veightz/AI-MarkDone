import { installVisualHarnessBridge, type VisualHarnessVariant } from '../visualHarnessBridge';
import { createAppearanceSnapshot } from '../../../src/style/appearance';
import { AppearanceScope } from '../../../src/style/appearanceScope';
import '../browserExtensionMock';
import { ButtonsSettingsView } from './ButtonsSettingsView';
import { DEFAULT_SETTINGS } from '../../../src/core/settings/types';
import { setLocale } from '../../../src/ui/content/components/i18n';
import packageJson from '../../../package.json';
const pageScope = AppearanceScope.forPage(document);
await setLocale('zh_CN');
let view = new ButtonsSettingsView(async () => true,async options=>(await import('../../../src/runtimes/export-renderer/formulaMathJax')).renderFormulaSvgAsset({...options,fontSizePx:options.fontSizePx??36}));
view.setState(structuredClone(DEFAULT_SETTINGS));
document.getElementById('app')!.append(view.root);
const { SettingsTransferPanel } = await import('./SettingsTransferPanel');
import type { SettingsTransferActions } from '../../../src/ui/content/bookmarks/ui/tabs/SettingsTransferPanel';
const { createSettingsFile, mergePortableSettings } = await import('../../../src/core/settings/portableSettings');
const { previewSettingsImport } = await import('../../../src/services/settings/settingsTransfer');
let current = structuredClone(DEFAULT_SETTINGS);
let recovery = null as ReturnType<typeof createSettingsFile> | null;
const transferActions: SettingsTransferActions = { exportSettings: async () => createSettingsFile(current, packageJson.version), previewImport: async (text) => previewSettingsImport(current, text), applyImport: async (text, fingerprint, categories) => { const preview = await previewSettingsImport(current, text); if (preview.fingerprint !== fingerprint)
        throw new Error('CONFLICT'); recovery = createSettingsFile(current, packageJson.version); current = mergePortableSettings(current, preview.file.settings, categories); return true; }, getRecovery: async () => recovery, onApplied: async () => { view.setState(current); } };
let transfer = new SettingsTransferPanel(transferActions);
document.getElementById('app')!.append(transfer.root);
let variant: VisualHarnessVariant = { theme: 'light', locale: 'zh_CN' };
async function applyVariant(next: VisualHarnessVariant) {
    await setLocale(next.locale);
    document.documentElement.dataset.aimdTheme = next.theme;
    pageScope.apply(createAppearanceSnapshot(next.theme));
    if (next.locale !== variant.locale) {
        // These production components resolve some labels at construction.
        // Recreate the disposable fixture surfaces just as a fresh UI entry does.
        view.dispose();
        transfer.dispose();
        view = new ButtonsSettingsView(async () => true, async options =>
            (await import('../../../src/runtimes/export-renderer/formulaMathJax')).renderFormulaSvgAsset({ ...options, fontSizePx: options.fontSizePx ?? 36 }));
        transfer = new SettingsTransferPanel(transferActions);
        document.getElementById('app')!.replaceChildren(view.root, transfer.root);
    }
    variant = next;
    view.setAppearance(createAppearanceSnapshot(next.theme));
    view.setState(current);
    transfer.setAppearance(createAppearanceSnapshot(next.theme));
}
await applyVariant(variant);
installVisualHarnessBridge({ applyVariant, prepareForAudit: async () => undefined, getState: () => ({ ...variant, expectedOpenSurfaces: [{ role: 'settings-buttons', count: 1 }, { role: 'settings-transfer', count: 1 }], localeEvidence: view.root.shadowRoot?.textContent ?? '' }) });
window.addEventListener('pagehide', () => { view.dispose(); transfer.dispose(); pageScope.dispose(); }, { once: true });
