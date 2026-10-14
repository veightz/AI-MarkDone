import '../browserExtensionMock';
import { installVisualHarnessBridge, type VisualHarnessVariant } from '../visualHarnessBridge';
import type { ReaderItem } from '../../../src/services/reader/types';
import type { ConversationContentSourceV1, ConversationSnapshotV1 } from '../../../src/contracts/conversationContent';

const [{ SaveMessagesDialog }, { ChatGPTAdapter }, { setLocale }, { getTokenCss }] = await Promise.all([
    import('../../../src/ui/content/export/SaveMessagesDialog'),
    import('../../../src/drivers/content/adapters/sites/chatgpt'),
    import('../../../src/ui/content/components/i18n'),
    import('../../../src/style/tokens'),
]);

const dialog = new SaveMessagesDialog();
const adapter = new ChatGPTAdapter();
let variant: VisualHarnessVariant = { theme: 'light', locale: 'en' };
let rich = true;
const style = document.createElement('style');
document.head.append(style);

function item(): ReaderItem {
    return {
        id: 'mock-rich-message',
        userPrompt: variant.locale === 'zh_CN' ? '比较这两组实验结果，并说明图表。' : 'Compare these results and explain the chart.',
        content: rich ? '## Results\n\nThe response contains a chart.\n\n![Results](aimd-rich:rich-1-example)' : '## Results\n\nA plain Markdown reply.',
        ...(rich ? { richBlocks: [{
            id: 'rich-1-example', kind: 'svg' as const, label: 'Results',
            visualDigest: 'example', fallbackMarkdown: '> [Results]\n> Alpha: 12; Beta: 7',
            source: { kind: 'svg' as const, svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 80"><path d="M0 0L120 80"/></svg>', width: 120, height: 80 },
        }] } : {}),
        meta: { platformId: 'chatgpt', assistantMessageId: 'mock-assistant', url: location.href },
    };
}

function contentSource(): ConversationContentSourceV1 {
    const reply = item();
    const snapshot: ConversationSnapshotV1 = {
        schemaVersion: 1,
        document: { key: 'chatgpt:conversation:fixture', platformId: 'chatgpt', conversationId: 'fixture', title: 'Export fixture', canonicalUrl: location.href },
        projectionId: `export-fixture-${rich}`, contentToken: `export-fixture-${rich}-${variant.locale}`,
        coverage: 'complete', historyStatus: 'partial',
        turns: [{
            key: 'fixture-turn', ordinal: 1,
            identity: { turnId: 'fixture-turn', assistantMessageId: 'mock-assistant', userMessageId: 'mock-user' },
            userText: reply.userPrompt, assistantMarkdown: String(reply.content), assistantRichBlocks: reply.richBlocks,
        }],
    };
    const state = { kind: 'ready' as const, document: snapshot.document, snapshot };
    return {
        read: () => state,
        subscribe: listener => { listener(state); return () => undefined; },
        refresh: async () => state,
        isCurrent: token => token === snapshot.contentToken,
    };
}

async function open(): Promise<void> {
    const status = document.querySelector<HTMLElement>('[data-role="mock-status"]')!;
    status.textContent = 'Opening…';
    await setLocale(variant.locale);
    style.textContent = `${getTokenCss(variant.theme).replace(/:host/g, ':root')} body{background:var(--aimd-bg-secondary);color:var(--aimd-text-primary)}`;
    document.documentElement.lang = variant.locale === 'zh_CN' ? 'zh-CN' : 'en';
    const opened = await dialog.open(adapter, variant.theme, { conversationContentSource: contentSource() });
    status.textContent = opened ? '' : 'The fixture content source was unavailable.';
    if (!opened) return;
    const host = document.getElementById('aimd-save-messages-dialog-host')!;
    host.setAttribute('data-aimd-role', 'message-export');
    host.shadowRoot?.querySelector<HTMLButtonElement>('[data-format="pdf"]')?.click();
}

document.querySelector('[data-action="open-rich"]')?.addEventListener('click', () => { rich = true; void open(); });
document.querySelector('[data-action="open-plain"]')?.addEventListener('click', () => { rich = false; void open(); });
document.querySelector('[data-action="toggle-theme"]')?.addEventListener('click', () => { variant.theme = variant.theme === 'light' ? 'dark' : 'light'; void open(); });
document.querySelector('[data-action="toggle-locale"]')?.addEventListener('click', () => { variant.locale = variant.locale === 'en' ? 'zh_CN' : 'en'; void open(); });

installVisualHarnessBridge({
    applyVariant: async next => { variant = next; rich = true; await open(); },
    prepareForAudit: async () => { await new Promise(resolve => setTimeout(resolve, 40)); },
    getState: () => ({
        ...variant,
        expectedOpenSurfaces: [{ role: 'message-export', count: dialog.isOpen() ? 1 : 0 }],
        localeEvidence: document.getElementById('aimd-save-messages-dialog-host')?.shadowRoot?.textContent ?? '',
    }),
});

await open();
