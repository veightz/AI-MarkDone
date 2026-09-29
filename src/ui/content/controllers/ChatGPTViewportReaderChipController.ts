import type { SiteAdapter } from '../../../drivers/content/adapters/base';
import { bookOpenIcon } from '../../../assets/workspaceIcons';
import {
    areAppearanceSnapshotsEqual,
    createAppearanceSnapshot,
    type AppearanceSnapshot,
} from '../../../style/appearance';
import { AppearanceScope } from '../../../style/appearanceScope';
import { subscribeLocaleChange, t } from '../components/i18n';
import {
    collectChatGPTRoundPositions,
    type ChatGPTRoundPosition,
} from '../chatgptDirectory/navigation';
import {
    PRIMARY_READ_HYSTERESIS_MS,
    resolvePrimaryReadAssistant,
    shouldUseViewportFixedChip,
    type PrimaryReadCandidate,
} from '../chatgptDirectory/primaryRead';
import { ChatGPTActivePositionTracker } from './ChatGPTActivePositionTracker';
import { TooltipDelegate } from '../../../utils/tooltip';
import {
    AIMD_CONVERSATION_SURFACE_CONSUMER_ATTRIBUTE,
    type ConversationSurfacePortV1,
} from '../../../contracts/conversationSurface';

const HOST_ID = 'aimd-chatgpt-viewport-reader-chip';
const STYLE_ID = 'aimd-chatgpt-viewport-reader-chip-style';
const TOKEN_STYLE_ID = 'aimd-chatgpt-viewport-reader-chip-tokens';

export type ViewportReaderChipOpenTarget = Readonly<{
    messageElement: HTMLElement;
    position: number;
    assistantMessageId: string | null;
}>;

type Options = {
    surface: ConversationSurfacePortV1;
    adapter: SiteAdapter;
    activePositionTracker?: ChatGPTActivePositionTracker;
    onOpenReader: (target: ViewportReaderChipOpenTarget) => void | Promise<void>;
};

/**
 * Primary Reader entry that follows the viewport's primary-read assistant
 * bubble (scheme A). Falls back to a viewport-fixed chip on narrow screens (B).
 */
export class ChatGPTViewportReaderChipController {
    private initialized = false;
    private host: HTMLElement | null = null;
    private button: HTMLButtonElement | null = null;
    private appearanceScope: AppearanceScope | null = null;
    private appearance: AppearanceSnapshot = createAppearanceSnapshot('light');
    private tooltipDelegate: TooltipDelegate | null = null;
    private unsubscribeLocale: (() => void) | null = null;
    private unsubscribeSurface: (() => void) | null = null;
    private unsubscribeTracker: (() => void) | null = null;
    private rafId: number | null = null;
    private resizeObserver: ResizeObserver | null = null;
    private pendingCandidate: PrimaryReadCandidate | null = null;
    private pendingSince = 0;
    private boundCandidate: PrimaryReadCandidate | null = null;
    private openInFlight = false;

    constructor(private readonly options: Options) {}

    init(): void {
        if (this.initialized) return;
        if (this.options.adapter.getPlatformId() !== 'chatgpt') return;
        this.initialized = true;
        this.ensureStyle();
        this.ensureHost();
        this.unsubscribeLocale = subscribeLocaleChange(() => this.syncLabel());
        this.unsubscribeSurface = this.options.surface.subscribeFrame(() => this.scheduleRefresh());
        if (this.options.activePositionTracker) {
            this.unsubscribeTracker = this.options.activePositionTracker.subscribe(() => this.scheduleRefresh());
        }
        window.addEventListener('scroll', this.handleScroll, { capture: true, passive: true });
        document.addEventListener('scroll', this.handleScroll, { capture: true, passive: true });
        window.addEventListener('resize', this.handleScroll, { passive: true });
        this.scheduleRefresh();
    }

    dispose(): void {
        if (!this.initialized) return;
        this.initialized = false;
        window.removeEventListener('scroll', this.handleScroll, true);
        document.removeEventListener('scroll', this.handleScroll, true);
        window.removeEventListener('resize', this.handleScroll);
        this.unsubscribeLocale?.();
        this.unsubscribeLocale = null;
        this.unsubscribeSurface?.();
        this.unsubscribeSurface = null;
        this.unsubscribeTracker?.();
        this.unsubscribeTracker = null;
        if (this.rafId !== null) {
            window.cancelAnimationFrame(this.rafId);
            this.rafId = null;
        }
        this.resizeObserver?.disconnect();
        this.resizeObserver = null;
        this.tooltipDelegate?.disconnect();
        this.tooltipDelegate = null;
        this.appearanceScope?.dispose();
        this.appearanceScope = null;
        this.host?.remove();
        this.host = null;
        this.button = null;
        this.boundCandidate = null;
        this.pendingCandidate = null;
        document.getElementById(STYLE_ID)?.remove();
    }

    setAppearance(next: AppearanceSnapshot | AppearanceSnapshot['theme']): void {
        const snapshot = typeof next === 'string' ? createAppearanceSnapshot(next) : next;
        if (areAppearanceSnapshotsEqual(this.appearance, snapshot)) return;
        this.appearance = snapshot;
        this.appearanceScope?.apply(snapshot);
    }

    getPrimaryReadTarget(): ViewportReaderChipOpenTarget | null {
        const candidate = this.boundCandidate;
        if (!candidate?.assistantRoot?.isConnected) return null;
        return {
            messageElement: candidate.assistantRoot,
            position: candidate.position,
            assistantMessageId: candidate.assistantMessageId,
        };
    }

    private readonly handleScroll = (): void => {
        this.scheduleRefresh();
    };

    private scheduleRefresh(): void {
        if (!this.initialized) return;
        if (document.documentElement.dataset.aimdViewportResizing === '1') return;
        if (this.rafId !== null) return;
        this.rafId = window.requestAnimationFrame(() => {
            this.rafId = null;
            this.refresh();
        });
    }

    private refresh(): void {
        if (!this.initialized || !this.host || !this.button) return;
        if (document.documentElement.dataset.aimdViewportResizing === '1') return;

        const rounds = this.collectEligibleRounds();
        const resolution = resolvePrimaryReadAssistant(rounds);
        const next = resolution.candidate;
        const now = performance.now();

        if (!next) {
            this.pendingCandidate = null;
            this.boundCandidate = null;
            this.hideChip();
            return;
        }

        const sameAsBound = this.sameCandidate(this.boundCandidate, next);
        if (sameAsBound) {
            this.pendingCandidate = null;
            this.placeChip(next);
            return;
        }

        if (!this.sameCandidate(this.pendingCandidate, next)) {
            this.pendingCandidate = next;
            this.pendingSince = now;
            // Keep previous chip placement until hysteresis elapses.
            if (this.boundCandidate) this.placeChip(this.boundCandidate);
            else this.hideChip();
            return;
        }

        if (now - this.pendingSince < PRIMARY_READ_HYSTERESIS_MS) {
            if (this.boundCandidate) this.placeChip(this.boundCandidate);
            return;
        }

        this.boundCandidate = next;
        this.pendingCandidate = null;
        this.placeChip(next);
    }

    private collectEligibleRounds(): ChatGPTRoundPosition[] {
        const rounds = collectChatGPTRoundPositions(this.options.surface);
        return rounds.filter((round) => {
            const root = round.assistantRoot;
            if (!root?.isConnected) return false;
            try {
                if (this.options.adapter.isStreamingMessage(root)) return false;
            } catch {
                // If streaming probe fails, keep the candidate (prefer showing over hiding).
            }
            return true;
        });
    }

    private sameCandidate(
        left: PrimaryReadCandidate | null,
        right: PrimaryReadCandidate | null,
    ): boolean {
        if (!left || !right) return false;
        if (left.assistantRoot && right.assistantRoot && left.assistantRoot === right.assistantRoot) {
            return true;
        }
        if (left.assistantMessageId && right.assistantMessageId) {
            return left.assistantMessageId === right.assistantMessageId;
        }
        return left.position === right.position;
    }

    private placeChip(candidate: PrimaryReadCandidate): void {
        const root = candidate.assistantRoot;
        if (!root?.isConnected || !this.host || !this.button) {
            this.hideChip();
            return;
        }

        const useFixed = shouldUseViewportFixedChip(window.innerWidth);
        const rect = root.getBoundingClientRect();
        if (useFixed) {
            this.host.dataset.placement = 'viewport-fixed';
            this.host.dataset.visible = '1';
            this.host.style.top = `${Math.round(window.innerHeight * 0.42)}px`;
            this.host.style.right = 'var(--aimd-space-2)';
            this.host.style.left = 'auto';
            this.host.style.transform = 'translateY(-50%)';
            this.syncLabel(candidate);
            return;
        }

        // Scheme A: bubble top-right outside.
        const chipWidth = this.host.offsetWidth || 88;
        const gap = 8;
        let left = Math.round(rect.right + gap);
        let top = Math.round(rect.top);
        // If outside would overflow, tuck just inside the right edge.
        if (left + chipWidth > window.innerWidth - 8) {
            left = Math.round(rect.right - chipWidth - gap);
        }
        if (left < 8) left = 8;
        if (top < 8) top = 8;
        if (top > window.innerHeight - 40) top = window.innerHeight - 40;

        this.host.dataset.placement = 'anchored';
        this.host.dataset.visible = '1';
        this.host.style.top = `${top}px`;
        this.host.style.left = `${left}px`;
        this.host.style.right = 'auto';
        this.host.style.transform = 'none';
        this.syncLabel(candidate);
    }

    private hideChip(): void {
        if (!this.host) return;
        this.host.dataset.visible = '0';
        this.host.dataset.placement = 'hidden';
    }

    private syncLabel(candidate: PrimaryReadCandidate | null = this.boundCandidate): void {
        if (!this.button) return;
        const label = t('btnReader');
        this.button.setAttribute('aria-label', label);
        this.button.dataset.tooltip = label;
        const text = this.button.querySelector<HTMLElement>('[data-role="chip-label"]');
        if (text) text.textContent = label;
        if (candidate?.position) {
            this.button.dataset.primaryPosition = String(candidate.position);
        } else {
            delete this.button.dataset.primaryPosition;
        }
    }

    private ensureHost(): void {
        if (this.host) return;
        let host = document.getElementById(HOST_ID);
        if (!(host instanceof HTMLElement)) {
            host = document.createElement('div');
            host.id = HOST_ID;
            document.body.appendChild(host);
        }
        host.className = 'aimd-chatgpt-viewport-reader-chip';
        host.dataset.aimdRole = 'chatgpt-viewport-reader-chip';
        host.setAttribute(AIMD_CONVERSATION_SURFACE_CONSUMER_ATTRIBUTE, '');
        host.dataset.visible = '0';
        host.dataset.placement = 'hidden';

        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'aimd-chatgpt-viewport-reader-chip__button';
        button.dataset.action = 'open-viewport-reader';
        const icon = document.createElement('span');
        icon.className = 'aimd-chatgpt-viewport-reader-chip__icon';
        icon.innerHTML = bookOpenIcon;
        icon.setAttribute('aria-hidden', 'true');
        const label = document.createElement('span');
        label.className = 'aimd-chatgpt-viewport-reader-chip__label';
        label.dataset.role = 'chip-label';
        label.textContent = t('btnReader');
        button.append(icon, label);
        button.addEventListener('click', () => {
            void this.handleOpen();
        });
        host.replaceChildren(button);
        this.host = host;
        this.button = button;
        this.tooltipDelegate?.disconnect();
        this.tooltipDelegate = new TooltipDelegate(host, { upgradeTitles: false });
        this.appearanceScope = AppearanceScope.forLightDomPortal(host, {
            selector: '.aimd-chatgpt-viewport-reader-chip',
            styleId: TOKEN_STYLE_ID,
        });
        this.appearanceScope.apply(this.appearance);
        this.syncLabel();
    }

    private async handleOpen(): Promise<void> {
        if (this.openInFlight) return;
        const target = this.getPrimaryReadTarget();
        if (!target) return;
        this.openInFlight = true;
        try {
            await this.options.onOpenReader(target);
        } finally {
            this.openInFlight = false;
        }
    }

    private ensureStyle(): void {
        if (document.getElementById(STYLE_ID)) return;
        const style = document.createElement('style');
        style.id = STYLE_ID;
        style.textContent = this.getCss();
        document.documentElement.appendChild(style);
    }

    private getCss(): string {
        return `.aimd-chatgpt-viewport-reader-chip {
  position: fixed;
  z-index: var(--aimd-z-panel);
  pointer-events: none;
  font-family: var(--aimd-font-family-sans);
}
.aimd-chatgpt-viewport-reader-chip[data-visible="0"] {
  display: none;
}
.aimd-chatgpt-viewport-reader-chip__button {
  all: unset;
  box-sizing: border-box;
  pointer-events: auto;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: calc(var(--aimd-space-1) + 2px);
  min-height: var(--aimd-size-control-icon-toolbar);
  padding: 0 var(--aimd-space-3) 0 var(--aimd-space-2);
  border-radius: var(--aimd-radius-full);
  border: 1px solid var(--aimd-workspace-border);
  color: var(--aimd-text-primary);
  background: color-mix(in srgb, var(--aimd-bg-surface) 86%, transparent);
  box-shadow: var(--aimd-workspace-raised);
  -webkit-backdrop-filter: blur(var(--aimd-space-4)) saturate(1.4);
  backdrop-filter: blur(var(--aimd-space-4)) saturate(1.4);
  transition: background var(--aimd-duration-fast) var(--aimd-ease-in-out),
    color var(--aimd-duration-fast) var(--aimd-ease-in-out),
    border-color var(--aimd-duration-fast) var(--aimd-ease-in-out);
}
.aimd-chatgpt-viewport-reader-chip__button:hover,
.aimd-chatgpt-viewport-reader-chip__button:focus-visible {
  background: var(--aimd-bg-surface);
  border-color: color-mix(in srgb, var(--aimd-accent) 45%, var(--aimd-workspace-border));
  color: var(--aimd-accent);
}
.aimd-chatgpt-viewport-reader-chip__icon {
  display: inline-flex;
  width: var(--aimd-size-control-glyph-panel);
  height: var(--aimd-size-control-glyph-panel);
}
.aimd-chatgpt-viewport-reader-chip__icon svg {
  width: 100%;
  height: 100%;
}
.aimd-chatgpt-viewport-reader-chip__label {
  font-size: var(--aimd-font-size-sm);
  font-weight: 600;
  line-height: 1;
  white-space: nowrap;
}
.aimd-chatgpt-viewport-reader-chip[data-placement="viewport-fixed"] .aimd-chatgpt-viewport-reader-chip__button {
  box-shadow: var(--aimd-workspace-raised);
}
@supports not (backdrop-filter: blur(1px)) {
  .aimd-chatgpt-viewport-reader-chip__button { background: var(--aimd-bg-surface); }
}
@media (prefers-reduced-motion: reduce) {
  .aimd-chatgpt-viewport-reader-chip__button { transition: none; }
}`;
    }
}
