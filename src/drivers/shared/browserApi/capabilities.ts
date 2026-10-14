import { resolveRuntimeApi } from './runtime';
import { resolveStorageApi } from './storage';

export type BrowserTarget = 'chrome' | 'firefox' | 'unknown';

export type BrowserTargetDetectionInput = {
    userAgent?: string;
    hasChrome?: boolean;
};

export type BrowserCapabilities = {
    hasStorageSync: boolean;
    hasImageClipboardWrite: boolean;
    manifestVersion: number;
};

export function detectBrowserTarget(input: BrowserTargetDetectionInput = {}): BrowserTarget {
    const userAgent = input.userAgent ?? '';
    if (userAgent.includes('Firefox')) return 'firefox';
    if (input.hasChrome) return 'chrome';
    return 'unknown';
}

export function resolveBrowserCapabilities(
    browserLike: any,
    env: { hasClipboardItem?: boolean } = {},
): BrowserCapabilities {
    const manifestVersion = Number(resolveRuntimeApi(browserLike)?.getManifest?.()?.manifest_version ?? 0);
    return {
        hasStorageSync: Boolean(resolveStorageApi(browserLike).sync),
        hasImageClipboardWrite: Boolean(env.hasClipboardItem),
        manifestVersion,
    };
}
