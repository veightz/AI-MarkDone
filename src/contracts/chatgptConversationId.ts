import { isChatGPTPageUrl } from './chatgptHosts';

export function getChatGPTConversationId(url: string): string | null {
    if (!isChatGPTPageUrl(url)) {
        try {
            const hostname = new URL(url, typeof window !== 'undefined' ? window.location.href : 'https://chatgpt.com').hostname;
            if (hostname !== 'localhost' && hostname !== '127.0.0.1' && hostname !== '[::1]') return null;
        } catch {
            return null;
        }
    }
    try {
        const segments = new URL(url, typeof window !== 'undefined' ? window.location.href : 'https://chatgpt.com').pathname.split('/').filter(Boolean);
        for (let index = 0; index < segments.length - 1; index += 1) {
            if (segments[index]?.toLowerCase() !== 'c' && segments[index]?.toLowerCase() !== 'conversation') continue;
            let candidate: string;
            try {
                candidate = decodeURIComponent(segments[index + 1] ?? '');
            } catch {
                continue;
            }
            if (candidate.length >= 8 && candidate.length <= 160 && /^[A-Za-z0-9][A-Za-z0-9._~-]*$/.test(candidate)) {
                return candidate;
            }
        }
    } catch {
        return null;
    }
    return null;
}
