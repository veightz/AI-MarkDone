import '../browserExtensionMock';
import { installHighlightFixture } from '../highlightFixture';

import { bookOpenIcon } from '../../../src/assets/icons';
import { DEFAULT_SETTINGS } from '../../../src/core/settings/types';
import type { SiteAdapter } from '../../../src/drivers/content/adapters/base';
import type { ReaderItem } from '../../../src/services/reader/types';
import { createAppearanceSnapshot } from '../../../src/style/appearance';
import { ensurePageTokens } from '../../../src/style/pageTokens';
import { MessageToolbar } from '../../../src/ui/content/MessageToolbar';
import { CommentPromptPickerPopover } from '../../../src/ui/content/components/CommentPromptPickerPopover';
import { setLocale, t } from '../../../src/ui/content/components/i18n';
import { ChatGPTMessageStepperController } from '../../../src/ui/content/controllers/ChatGPTMessageStepperController';
import { ReaderPanel } from '../../../src/ui/content/reader/ReaderPanel';
import { ReaderCommentExportPopover } from '../../../src/ui/content/reader/ReaderCommentExportPopover';
import { createConversationReaderActions } from '../../../src/ui/content/reader/conversationReaderActions';
import {
    installVisualHarnessBridge,
    type VisualHarnessVariant,
} from '../visualHarnessBridge';

ensurePageTokens();
history.replaceState({}, '', '/c/12345678-abcd-4abc-8def-1234567890ab' + window.location.search);

const readerItems: ReaderItem[] = [
    {
        id: 'reader-fixture-1',
        userPrompt: 'Summarize the principles behind a durable interface architecture.',
        content: [
            '# Durable interface architecture',
            '',
            'A resilient UI keeps **appearance**, lifecycle, and responsive geometry explicit while preserving the host application.',
            '',
            '## Core principles',
            '',
            '- One scroll owner per surface',
            '- Deterministic focus and Escape behavior',
            '- Tokenized spacing, color, radius, elevation, and motion',
            '',
            '> The surface should remain useful at narrow widths, short heights, long localized copy, and reduced motion.',
            '',
            '| Concern | Owner |',
            '| --- | --- |',
            '| Appearance | AppearanceSnapshot |',
            '| Lifecycle | SurfaceSession |',
            '| Geometry | Responsive profile |',
            '',
            '```ts',
            'const surface = { scrollOwner: "content", collision: "clamp" };',
            '```',
            '',
            '$$E = mc^2$$',
        ].join('\n'),
        meta: { position: 1, messageId: 'assistant-1', url: window.location.href },
    },
    {
        id: 'reader-fixture-2',
        userPrompt: 'How should the layout adapt under constrained viewports?',
        content: [
            '# Responsive contract',
            '',
            'At 900px the auxiliary outline yields to the reading flow. At 560px the Reader becomes a single-column viewport surface.',
            '',
            '## Short-height behavior',
            '',
            'The header and footer remain reachable while the central body owns vertical scrolling. Long Chinese and English copy must wrap without creating horizontal overflow.',
            '',
            '## Interaction states',
            '',
            'Keyboard focus, disabled controls, pending operations, comments, and settings all retain visible and predictable feedback.',
        ].join('\n'),
        meta: { position: 2, messageId: 'assistant-2', url: window.location.href },
    },
    {
        id: 'reader-fixture-3',
        userPrompt: 'List the final verification matrix.',
        content: [
            '# Verification matrix',
            '',
            'Validate 320, 390, 768, 1024, and 1440 pixel widths; 568 and 900 pixel heights; light and dark themes; English and Chinese; default and reduced motion.',
            '',
            '1. No horizontal overflow',
            '2. No clipped controls',
            '3. No competing body and surface scroll owners',
            '4. No focus or teardown leaks',
        ].join('\n'),
        meta: { position: 3, messageId: 'assistant-3', url: window.location.href },
    },
];

const browserApi = (globalThis as typeof globalThis & { browser: any }).browser;
browserApi.runtime.getURL = (path: string) => path.startsWith('vendor/katex/')
    ? `/node_modules/katex/dist/${path.slice('vendor/katex/'.length)}`
    : `/${path}`;
browserApi.runtime.sendMessage = async (request: { v: number; id: string; type: string }) => ({
    v: request.v,
    id: request.id,
    type: request.type,
    ok: true,
    data: request.type === 'bookmarks:changelogNotice:get'
        ? { pendingVersion: null, lastShownVersion: null, reason: null, previousVersion: null }
        : {},
});

const conversationRoot = document.querySelector<HTMLElement>('[data-role="conversation-root"]')!;
const user = conversationRoot.querySelector<HTMLElement>('.user-message')!;
const assistant = conversationRoot.querySelector<HTMLElement>('.assistant-message')!;
const content = conversationRoot.querySelector<HTMLElement>('.assistant-content')!;
const adapter = {
    matches: () => true,
    getPlatformId: () => 'chatgpt',
    getThemeDetector: () => ({
        detect: () => 'light' as const,
        getObserveTargets: () => [],
        hasExplicitTheme: () => true,
    }),
    extractUserPrompt: () => user.textContent,
    getMessageSelector: () => '.assistant-message',
    getMessageContentSelector: () => '.assistant-content',
    getActionBarSelector: () => '.official-actions',
    getToolbarAnchorElement: () => assistant.querySelector<HTMLElement>('.official-actions'),
    isStreamingMessage: () => false,
    getMessageId: () => 'assistant-1',
    getObserverContainer: () => conversationRoot,
    getConversationGroupRefs: () => [{
        id: 'turn-1',
        assistantRootEl: assistant,
        assistantMessageEl: assistant,
        assistantContentRootEl: content,
        userRootEl: user,
        userPromptText: user.textContent,
        userPromptQuality: 'real',
        barAnchorEl: user,
        groupEls: [user, assistant],
        assistantIndex: 0,
        isStreaming: false,
    }],
} as unknown as SiteAdapter;

const panel = new ReaderPanel();
const fixturePromptPicker = new CommentPromptPickerPopover();
const fixtureCommentExport = new ReaderCommentExportPopover();
let toolbar: MessageToolbar | null = null;
let stepper: ChatGPTMessageStepperController | null = null;
const fixtureParams = new URLSearchParams(window.location.search);
let variant: VisualHarnessVariant = { theme: fixtureParams.get('theme') === 'dark' ? 'dark' : 'light', locale: fixtureParams.get('locale') === 'zh_CN' ? 'zh_CN' : 'en' };
let lastTrigger: 'toolbar' | 'page-control' = 'toolbar';

const nextTask = (): Promise<void> => new Promise((resolve) => window.setTimeout(resolve, 0));

function getReaderActions() {
    return createConversationReaderActions({
        locate: {
            locate: async () => ({ ok: true, message: variant.locale === 'zh_CN' ? '已定位到消息' : 'Located message' }),
        },
    });
}

async function showReader(trigger: 'toolbar' | 'page-control'): Promise<void> {
    lastTrigger = trigger;
    await panel.show(readerItems, 0, variant.theme, {
        annotationDocument: { platform: 'chatgpt', conversationId: fixtureParams.get('conversation') || 'visual-reader', title: 'Reader highlight preview', lastKnownUrl: `https://chatgpt.com/c/${fixtureParams.get('conversation') || 'visual-reader'}` },
        profile: 'conversation-reader',
        actions: getReaderActions(),
    });
}

async function waitForReader(): Promise<HTMLElement> {
    for (let attempt = 0; attempt < 120; attempt += 1) {
        const host = document.getElementById('aimd-reader-panel-host');
        if (host?.shadowRoot?.querySelector('.panel-window--reader')
            && host.shadowRoot.querySelector('.reader-markdown h1')) {
            return host;
        }
        await nextTask();
    }
    throw new Error('Reader fixture did not mount the production ReaderPanel.');
}

async function closeReader(): Promise<void> {
    const host = document.getElementById('aimd-reader-panel-host');
    if (!host) return;
    if (host.shadowRoot) {
        fixturePromptPicker.close(host.shadowRoot);
        fixtureCommentExport.close(host.shadowRoot);
    }
    host.removeAttribute('data-aimd-role');
    panel.hide();
    host.shadowRoot?.querySelector<HTMLElement>('.panel-window--reader')
        ?.dispatchEvent(new Event('animationend', { bubbles: true }));
    await nextTask();
}

function openTransientFixture(host: HTMLElement): void {
    const transient = fixtureParams.get('transient');
    const shadow = host.shadowRoot;
    const container = shadow?.querySelector<HTMLElement>('.panel-window--reader');
    const anchor = container?.querySelector<HTMLElement>('[data-action="reader-copy-comments"]');
    if (!shadow || !container || !anchor || !container.parentElement) return;
    const zh = variant.locale === 'zh_CN';
    const openExport = () => fixtureCommentExport.open({
        shadow, container, theme: variant.theme,
        preview: Array.from({ length: 12 }, (_, index) => zh
            ? `## 注释 ${index + 1}\n\n> 长篇原文与完整注释会在预览区域内换行，并保留可访问的复制和关闭操作。\n\n这是用于窄屏及短高度验收的长篇注释。`
            : `## Annotation ${index + 1}\n\n> Long source text and complete annotations wrap inside the preview while copy and close actions remain reachable.\n\nThis is a deliberately long annotation for narrow and short viewport review.`).join('\n\n'),
        canCopy: true,
        labels: {
            title: zh ? '复制带有完整上下文和原文引用的注释' : 'Copy annotations with complete context and source references',
            close: zh ? '关闭' : 'Close',
            copy: zh ? '复制全部注释和原文引用' : 'Copy all annotations and source references',
            copied: zh ? '已复制' : 'Copied!',
        },
        onCopy: async () => true,
    });
    if (transient === 'comment-export') openExport();
    if (transient === 'prompt-picker') fixturePromptPicker.open({
        shadow, container: container.parentElement, anchorEl: anchor, placement: 'center', theme: variant.theme,
        labels: { title: zh ? '选择用于整理注释及完整原文引用的提示词' : 'Choose a prompt for annotations and complete source references', close: zh ? '关闭' : 'Close', empty: zh ? '暂无提示词' : 'No prompts available.' },
        prompts: Array.from({ length: 10 }, (_, index) => ({
            id: `fixture-prompt-${index}`,
            title: zh ? `注释整理 ${index + 1}：保留上下文和引用的详细阅读笔记` : `Annotation review ${index + 1}: detailed reading notes preserving context and source references`,
            content: zh ? '请根据原文引用及用户注释整理阅读笔记，并保留关键问题。{{cursor}}' : 'Organize reading notes from source references and user annotations, preserving the important questions. {{cursor}}',
        })),
        onSelect: openExport,
    });
}

function mountToolbar(): void {
    toolbar?.dispose();
    toolbar?.getElement().remove();
    toolbar = new MessageToolbar(variant.theme, [{
        id: 'reader',
        label: t('btnReader'),
        tooltip: t('btnReader'),
        icon: bookOpenIcon,
        kind: 'secondary',
        onClick: async () => showReader('toolbar'),
    }]);
    toolbar.setPlacement('actionbar');
    assistant.querySelector<HTMLElement>('.official-actions')!.replaceChildren(toolbar.getElement());
}

function mountPageControl(): void {
    stepper?.dispose();
    stepper = new ChatGPTMessageStepperController(adapter, {
        surface: {
            readFrame: () => ({frameToken:'fixture',surfaceToken:'fixture',contentKind:'ready',document:null,snapshot:null,projectionId:'fixture',contentToken:'fixture',obtainedTurns:[],pendingSurfaces:[]}),
            subscribeFrame: listener => {listener();return ()=>undefined;}, refreshSurface:()=>undefined, materialization:{} as any,
        },
        onOpenDetachedReader: () => showReader('page-control'),
        onTogglePageBookmark: () => ({ saved: false }),
        onRefreshPageBookmarkState: () => false,
    });
    stepper.init();
    stepper.setAppearance(createAppearanceSnapshot(variant.theme));
}

async function openFromProductionTrigger(usePageControl: boolean): Promise<HTMLElement> {
    const selector = usePageControl
        ? '[data-action="open-detached-reader"]'
        : '[data-action="reader"]';
    const button = usePageControl
        ? document.querySelector<HTMLButtonElement>(selector)
        : toolbar?.getElement().shadowRoot?.querySelector<HTMLButtonElement>(selector);
    if (!button) throw new Error(`Production Reader trigger is unavailable: ${selector}`);
    button.focus();
    button.click();
    const host = await waitForReader();
    host.setAttribute('data-aimd-role', 'reader-panel');
    return host;
}

async function applyVariant(next: VisualHarnessVariant): Promise<void> {
    await closeReader();
    variant = next;
    document.documentElement.dataset.aimdTheme = next.theme;
    document.documentElement.lang = next.locale === 'zh_CN' ? 'zh-CN' : 'en';
    document.body.dataset.theme = next.theme;
    await setLocale(next.locale);

    const zh = next.locale === 'zh_CN';
    document.querySelector<HTMLElement>('[data-role="fixture-title"]')!.textContent = zh ? '阅读器面板入口' : 'Reader panel entry';
    document.querySelector<HTMLElement>('[data-role="fixture-description"]')!.textContent = zh
        ? '真实工具栏与页面控制按钮会打开生产环境中的阅读器。'
        : 'The production toolbar and page control open the production Reader panel.';

    panel.setAppearance(createAppearanceSnapshot(next.theme));
    panel.setReaderSettings({
        ...DEFAULT_SETTINGS.reader,
        defaultOpenMode: 'panel',
        showOutlineInReader: true,
    });
    mountToolbar();
    mountPageControl();
    const host = await openFromProductionTrigger(next.theme === 'dark');
    if (fixtureParams.get('settings') === '1' || fixtureParams.get('template') === '1') {
        const settings = host.shadowRoot?.querySelector<HTMLButtonElement>('[data-action="reader-settings"]');
        settings?.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, composed: true }));
        settings?.click();
        if (fixtureParams.get('template') === '1') {
            const template = host.shadowRoot?.querySelector<HTMLButtonElement>('[data-action="reader-settings-comment-template"]');
            template?.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, composed: true }));
            template?.click();
        }
    }
    openTransientFixture(host);
}

installHighlightFixture();
readerItems.forEach(item => { item.meta = {...item.meta, assistantMessageId: item.meta?.messageId}; });
await applyVariant(variant);

installVisualHarnessBridge({
    applyVariant,
    prepareForAudit: async () => {
        await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
    },
    getState: () => ({
        ...variant,
        expectedOpenSurfaces: [{ role: 'reader-panel', count: 1 }],
        localeEvidence: [
            lastTrigger,
            document.getElementById('aimd-reader-panel-host')?.shadowRoot?.textContent ?? '',
        ].join(' '),
    }),
});

window.addEventListener('pagehide', () => {
    const shadow = document.getElementById('aimd-reader-panel-host')?.shadowRoot;
    if (shadow) {
        fixturePromptPicker.close(shadow);
        fixtureCommentExport.close(shadow);
    }
    toolbar?.dispose();
    stepper?.dispose();
    panel.hide();
}, { once: true });
