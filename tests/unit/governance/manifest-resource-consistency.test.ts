import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { CHATGPT_HOST_PATTERNS, SUPPORTED_HOST_PATTERNS } from '../../../config/extension/hosts';

type ChromeManifest = {
    host_permissions?: string[];
    icons?: Record<string, string>;
    action?: { default_icon?: Record<string, string> };
    background?: { service_worker?: string };
    content_scripts?: Array<{ js?: string[]; matches?: string[]; run_at?: string; world?: string }>;
    web_accessible_resources?: Array<{ resources?: string[]; matches?: string[] }>;
};

type Mv2Manifest = {
    permissions?: string[];
    icons?: Record<string, string>;
    browser_action?: { default_icon?: Record<string, string> };
    background?: { scripts?: string[] };
    content_scripts?: Array<{ js?: string[]; matches?: string[]; run_at?: string; world?: string }>;
    web_accessible_resources?: string[];
};

function readJson<T>(file: string): T {
    return JSON.parse(readFileSync(resolve(process.cwd(), file), 'utf-8')) as T;
}

function normalized(values: string[] | undefined): string[] {
    return Array.from(new Set(values || [])).sort();
}

describe('manifest resource consistency', () => {
    it('web_accessible_resources should stay aligned across chrome and firefox target manifests', () => {
        const chrome = readJson<ChromeManifest>('manifest.chrome.json');
        const firefox = readJson<Mv2Manifest>('manifest.firefox.json');

        const chromeResources = normalized(chrome.web_accessible_resources?.[0]?.resources);
        const firefoxResources = normalized(firefox.web_accessible_resources);

        expect(chromeResources.length).toBeGreaterThan(0);
        expect(chromeResources).toEqual(firefoxResources);
        expect(chromeResources).toContain('content-features.js');
        expect(chromeResources).toContain('content-feature-chunks/*.js');
        expect(chromeResources).toContain('export-renderer.html');
        expect(chromeResources).toContain('rich-asset-relay.html');
        expect(chromeResources).not.toContain('rich-asset-relay.js');
        expect(chromeResources).not.toContain('export-renderer.js');
        expect(chromeResources).not.toContain('export-renderer-chunks/*.js');
        expect(chromeResources).not.toContain('png-encoder-worker.js');
    });





    it('chrome web_accessible_resources matches should stay limited to supported content hosts', () => {
        const chrome = readJson<ChromeManifest>('manifest.chrome.json');
        const resourceMatches = normalized(chrome.web_accessible_resources?.[0]?.matches);

        expect(resourceMatches.length).toBeGreaterThan(0);
        expect(resourceMatches).toEqual(normalized(SUPPORTED_HOST_PATTERNS));
        expect(chrome.host_permissions).toContain('https://www.googleapis.com/*');
        expect(chrome.host_permissions).toContain('https://oauth2.googleapis.com/*');
    });

    it('toolbar/action icon paths should stay aligned across manifests', () => {
        const chrome = readJson<ChromeManifest>('manifest.chrome.json');
        const firefox = readJson<Mv2Manifest>('manifest.firefox.json');

        const chromeIcons = chrome.action?.default_icon || {};
        const firefoxIcons = firefox.browser_action?.default_icon || {};

        expect(chromeIcons).toEqual(firefoxIcons);
        expect(chrome.icons).toEqual(firefox.icons);
    });

    it('background entries should match each target runtime model', () => {
        const chrome = readJson<ChromeManifest>('manifest.chrome.json');
        const firefox = readJson<Mv2Manifest>('manifest.firefox.json');

        expect(chrome.background).toEqual({ service_worker: 'background.js' });
        expect(firefox.background).toEqual({ scripts: ['background.js'] });
    });

    it('default manifests should not expose ChatGPT early-prune entrypoints', () => {
        const chrome = readJson<ChromeManifest>('manifest.chrome.json');
        const firefox = readJson<Mv2Manifest>('manifest.firefox.json');

        const chromeScripts = chrome.content_scripts?.flatMap((item) => item.js || []) || [];
        const firefoxScripts = firefox.content_scripts?.flatMap((item) => item.js || []) || [];
        const chromeResources = normalized(chrome.web_accessible_resources?.[0]?.resources);
        const firefoxResources = normalized(firefox.web_accessible_resources);

        expect(chromeScripts).not.toContain('content-early.js');
        expect(firefoxScripts).not.toContain('content-early.js');
        expect(chromeResources).not.toContain('content-early-main.js');
        expect(firefoxResources).not.toContain('content-early-main.js');
    });

    it('ships the 5.3 GET seed bridge only for Chrome and Firefox', () => {
        const chrome = readJson<ChromeManifest>('manifest.chrome.json');
        const firefox = readJson<Mv2Manifest>('manifest.firefox.json');

        for (const manifest of [chrome, firefox]) {
            const entries = manifest.content_scripts || [];
            const scripts = entries.flatMap((item) => item.js || []);
            expect(scripts).toContain('page-bridges/chatgpt-conversation-bootstrap.js');
            const bootstrapEntry = entries.find((item) => item.js?.includes('page-bridges/chatgpt-conversation-bootstrap.js'));
            expect(bootstrapEntry).toMatchObject({ matches: [...CHATGPT_HOST_PATTERNS], run_at: 'document_start' });
            const resources = normalized(
                'web_accessible_resources' in manifest
                    ? Array.isArray(manifest.web_accessible_resources)
                        ? (manifest.web_accessible_resources[0] as { resources?: string[] } | undefined)?.resources
                            ?? (manifest.web_accessible_resources as unknown as string[])
                        : []
                    : [],
            );
            expect(resources).toContain('page-bridges/chatgpt-conversation-bridge.js');
        }


        for (const manifest of [chrome, firefox]) {
            const idleEntry = manifest.content_scripts?.find((item) => item.js?.includes('content.js'));
            expect(idleEntry).toMatchObject({
                matches: [...SUPPORTED_HOST_PATTERNS],
                run_at: 'document_idle',
            });
        }
    });

});
