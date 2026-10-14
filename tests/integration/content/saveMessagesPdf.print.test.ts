import { afterEach, describe, expect, it, vi } from 'vitest';
import { SaveMessagesDialog } from '@/ui/content/export/SaveMessagesDialog';
import { createConversationContentSource } from '../../helpers/chatgptContentFixtures';

describe('Save Messages PDF print trigger', () => {
    afterEach(() => {
        document.body.innerHTML = '';
        vi.restoreAllMocks();
    });

    it.each([false, true])('prints canonical content from the real save button (all messages: %s)', async (selectAll) => {
        const source = createConversationContentSource({
            conversationId: 'pdf-conversation',
            rounds: [1, 2].map((position) => ({
                id: `turn-${position}`, position,
                userPrompt: `Question ${position}`,
                assistantContent: `Answer ${position}\n\n- item ${position}`,
                messageId: `assistant-${position}`, assistantMessageId: `assistant-${position}`,
                userMessageId: `user-${position}`,
            })),
        });
        const hostPrint = vi.spyOn(window, 'print').mockImplementation(() => {});
        const framePrint = vi.fn();
        const append = document.body.appendChild.bind(document.body);
        vi.spyOn(document.body, 'appendChild').mockImplementation((node) => {
            const result = append(node);
            if (node instanceof HTMLIFrameElement) node.contentWindow!.print = framePrint;
            return result;
        });
        const dialog = new SaveMessagesDialog();
        await dialog.open({ getPlatformId: () => 'chatgpt' } as any, 'light', { conversationContentSource: source });
        const shadow = document.getElementById('aimd-save-messages-dialog-host')!.shadowRoot!;
        const click = (selector: string) => {
            const button = shadow.querySelector<HTMLButtonElement>(selector)!;
            button.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, composed: true }));
            button.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }));
        };
        if (selectAll) click('[data-action="select-all-turns"]');
        click('[data-format="pdf"]');
        click('[data-action="save-turns"]');
        await vi.waitFor(() => expect(framePrint).toHaveBeenCalledTimes(1));

        const frame = document.querySelector<HTMLIFrameElement>('#aimd-pdf-export-container-frame')!;
        const printDoc = frame.contentDocument!;
        expect(printDoc.querySelectorAll('.message-section')).toHaveLength(selectAll ? 2 : 1);
        expect(printDoc.body.textContent).toContain('Question 2');
        expect(printDoc.body.textContent).toContain('Answer 2');
        expect(printDoc.body.textContent?.includes('Answer 1')).toBe(selectAll);
        expect(printDoc.querySelector('li')?.textContent).toBe(`item ${selectAll ? 1 : 2}`);
        expect(document.getElementById('aimd-save-messages-dialog-host')).toBeNull();
        expect(hostPrint).not.toHaveBeenCalled();
        frame.contentWindow!.dispatchEvent(new Event('afterprint'));
        expect(document.getElementById('aimd-pdf-export-container-frame')).toBeNull();
    });
});
