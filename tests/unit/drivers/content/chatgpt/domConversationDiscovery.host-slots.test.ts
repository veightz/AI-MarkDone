import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { ChatGPTAdapter } from '@/drivers/content/adapters/sites/chatgpt';
import {
    collectChatGPTDomHostSlots,
    collectChatGPTDomRoundRefs,
    resolveChatGPTDomRoundHostSlotId,
} from '@/drivers/content/chatgpt/domConversationDiscovery';

function hydratedSlot(index: number, role: 'user' | 'assistant'): string {
    const slotId = `${role}-slot-${index}`;
    const messageId = `${role}-${index}`;
    return `
        <div data-turn-id-container="${slotId}">
            <section data-turn="${role}" data-turn-id="${slotId}" data-turn-id-container="${slotId}">
                <div data-message-author-role="${role}" data-message-id="${messageId}">
                    <div class="${role === 'assistant' ? 'markdown prose' : 'whitespace-pre-wrap'}">
                        ${role === 'assistant' ? `Answer ${index}` : `Question ${index}`}
                    </div>
                </div>
                ${role === 'assistant' ? '<div class="z-0 flex"><button data-testid="copy-turn-action-button">Copy</button></div>' : ''}
            </section>
        </div>
    `;
}

describe('ChatGPT persistent host-slot seam', () => {
    let adapter: ChatGPTAdapter;

    beforeEach(() => {
        document.documentElement.innerHTML = '<head></head><body><main><div id="host-slots"></div></main></body>';
        adapter = new ChatGPTAdapter();
    });

    afterEach(() => {
        adapter.dispose();
    });

    it('collects only deduplicated outer slots and excludes nested markers and sentinels', () => {
        document.querySelector('#host-slots')!.innerHTML = `
            <div data-turn-id-container="client-created-root"></div>
            ${hydratedSlot(1, 'user')}
            <div data-turn-id-container="assistant-slot-1"></div>
            ${hydratedSlot(1, 'assistant')}
            <div data-turn-id-container="future-slot"></div>
        `;

        expect(collectChatGPTDomHostSlots(adapter).map((slot) => slot.id)).toEqual([
            'user-slot-1',
            'assistant-slot-1',
            'future-slot',
        ]);
    });

    it('binds a hydrated assistant round to its containing outer slot', () => {
        document.querySelector('#host-slots')!.innerHTML = `
            <div data-turn-id-container="empty-history-slot"></div>
            ${hydratedSlot(1, 'user')}
            ${hydratedSlot(1, 'assistant')}
        `;
        const slots = collectChatGPTDomHostSlots(adapter);
        const [round] = collectChatGPTDomRoundRefs(adapter);

        expect(resolveChatGPTDomRoundHostSlotId(round!, slots)).toBe('assistant-slot-1');
    });

    it('keeps old and current outer slots in document order during a host transition', () => {
        document.querySelector('#host-slots')!.innerHTML = `
            ${hydratedSlot(1, 'user')}
            ${hydratedSlot(1, 'assistant')}
            <div data-turn-key="user-2">
              <div data-content-search-turn-key="round-2">
                <div data-chatgpt-search-unit-key="round-2:0:user" data-chatgpt-search-message-ids="user-2">Question 2</div>
                <div class="group flex flex-col pb-2 pt-2">
                  <div data-chatgpt-search-unit-key="round-2:2:assistant" data-chatgpt-search-message-ids="assistant-2 assistant-2">
                    <div data-markdown-text-style="assistant-message">Answer 2</div>
                  </div>
                  <div class="turn-action-controls"><button aria-label="复制">Copy</button></div>
                </div>
              </div>
            </div>`;
        const slots = collectChatGPTDomHostSlots(adapter);
        expect(slots.map((slot) => slot.id)).toEqual(['user-slot-1', 'assistant-slot-1', 'user-2']);
        const rounds = collectChatGPTDomRoundRefs(adapter);
        expect(rounds.map((round) => resolveChatGPTDomRoundHostSlotId(round, slots))).toEqual([
            'assistant-slot-1', 'user-2',
        ]);
    });
});
