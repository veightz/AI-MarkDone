import { describe, expect, it, vi } from 'vitest';
import { BookmarksCloudBackupWorkflow } from '@/ui/content/bookmarks/workflows/BookmarksCloudBackupWorkflow';
import * as i18n from '@/ui/content/components/i18n';
import { ModalHost } from '@/ui/content/components/ModalHost';
import { CloudBackupSettingsPanel } from '@/ui/content/bookmarks/ui/cloudBackup/CloudBackupSettingsPanel';

describe('BookmarksCloudBackupWorkflow', () => {
    it('opens shared snapshot and merge materials through the real restore control without applying on cancel', async () => {
        const host = document.createElement('div');
        document.body.append(host);
        const shadow = host.attachShadow({ mode: 'open' });
        const modal = new ModalHost(shadow);
        const client = {
            status: vi.fn(async () => ({ ok: true, data: { connected: true } })),
            listSnapshots: vi.fn(async () => ({ ok: true, data: { snapshots: [
                { snapshotId: 'snapshot-1', name: 'Library.json', createdAt: '2026-10-08T00:00:00.000Z', size: 2048 },
            ] } })),
            previewRestore: vi.fn(async () => ({ ok: true, data: {
                snapshot: { snapshotId: 'snapshot-1', payloadHash: `sha256:${'a'.repeat(64)}` },
                plan: { bookmarksToUpsert: [{}], duplicateCount: 2, localOnlyCount: 1, conflictCount: 0 },
            } })),
            applyRestore: vi.fn(),
        };
        const workflow = new BookmarksCloudBackupWorkflow({ getModalHost: () => modal, client: client as any });
        const panel = new CloudBackupSettingsPanel({ modal, actions: workflow.createSettingsActions() });
        shadow.append(panel.getElement());
        try {
            await vi.waitFor(() => expect(shadow.querySelector('[data-role="cloud-backup-google-drive-restore"]')).toBeTruthy());
            shadow.querySelector<HTMLButtonElement>('[data-role="cloud-backup-google-drive-restore"]')!.click();
            await vi.waitFor(() => expect(shadow.querySelector('[role="radio"]')).toBeTruthy());
            expect(shadow.querySelector('[role="radio"]')?.classList.contains('aimd-material-choice')).toBe(true);
            expect(shadow.querySelector('[role="radio"]')?.getAttribute('aria-checked')).toBe('true');
            const snapshotModal = shadow.querySelector('[role="radio"]')!.closest('.mock-modal')!;
            snapshotModal.querySelector<HTMLButtonElement>('[data-action="modal-confirm"]')!.click();
            await vi.waitFor(() => expect(shadow.querySelector('.import-merge-review')).toBeTruthy());
            const review = shadow.querySelector('.import-merge-review')!;
            expect(review.querySelector('.merge-summary-item')?.classList.contains('aimd-material-card')).toBe(true);
            expect(review.querySelector('.merge-entry')?.classList.contains('aimd-material-card')).toBe(true);
            expect(client.applyRestore).not.toHaveBeenCalled();
            review.closest('.mock-modal')!.querySelector<HTMLButtonElement>('[data-action="modal-cancel"]')!.click();
            await Promise.resolve();
            expect(client.applyRestore).not.toHaveBeenCalled();
        } finally {
            host.remove();
        }
    });

    it('shows the connected account once in the real backup settings body', async () => {
        const translation = vi.spyOn(i18n, 't').mockImplementation((key, substitutions) => key === 'cloudBackupConnectedAs'
            ? `Connected as ${Array.isArray(substitutions) ? substitutions[0] : substitutions}`
            : key);
        const modal = { showCustom: vi.fn(async () => undefined) };
        const client = { status: vi.fn(async () => ({ ok: true, data: {
            connected: true, connectedAccount: { accountDisplayName: 'Alice', accountEmail: 'alice@example.com' },
        } })) };
        const workflow = new BookmarksCloudBackupWorkflow({ getModalHost: () => modal as any, client: client as any });
        try {
            await workflow.createSettingsActions().openSettings?.();
            const body = (modal.showCustom.mock.calls[0] as unknown as [{ body: HTMLElement }])[0].body;
            expect(body.textContent?.match(/alice@example\.com/g)).toHaveLength(1);
            expect(body.textContent).toContain('Alice');
            expect(body.querySelector('.cloud-backup-settings-modal__status-card')?.classList.contains('aimd-material-card')).toBe(true);
            expect(body.querySelector('.cloud-backup-settings-modal__privacy')?.classList.contains('aimd-material-card')).toBe(true);
        } finally {
            translation.mockRestore();
        }
    });
    it('concentrates Settings cloud status and connection behavior behind one workflow interface', async () => {
        const client = {
            status: vi.fn(async () => ({ ok: true, data: { connected: true } })),
            connect: vi.fn(async () => ({ ok: true, data: { connected: true } })),
            disconnect: vi.fn(async () => ({ ok: true, data: { connected: false } })),
        };
        const modal = {
            confirm: vi.fn(async () => true),
            alert: vi.fn(async () => undefined),
        };
        const workflow = new BookmarksCloudBackupWorkflow({
            getModalHost: () => modal as any,
            client: client as any,
        });
        const actions = workflow.createSettingsActions();

        await expect(actions.status('googleDrive')).resolves.toEqual({ connected: true });
        await expect(actions.connect('googleDrive')).resolves.toEqual({ connected: true });
        await expect(actions.disconnect('googleDrive')).resolves.toEqual({ connected: false });
        expect(modal.confirm).toHaveBeenCalledTimes(1);
        expect(client.connect).toHaveBeenCalledWith('googleDrive');
        expect(client.disconnect).toHaveBeenCalledWith('googleDrive');
    });

    it('keeps restore as one safe-merge workflow from snapshot choice through explicit confirmation', async () => {
        const client = {
            listSnapshots: vi.fn(async () => ({
                ok: true,
                data: {
                    snapshots: [{ snapshotId: 'snapshot-1', name: 'backup.json', createdAt: '2026-07-15T00:00:00.000Z', size: 256 }],
                },
            })),
            previewRestore: vi.fn(async () => ({
                ok: true,
                data: {
                    snapshot: { snapshotId: 'snapshot-1', payloadHash: `sha256:${'a'.repeat(64)}` },
                    plan: { bookmarksToUpsert: [], duplicateCount: 0, localOnlyCount: 0, conflictCount: 0 },
                },
            })),
            applyRestore: vi.fn(async () => ({
                ok: true,
                data: { restored: 0, localOnly: 0, skippedDuplicates: 0, conflicts: 0 },
            })),
        };
        const modal = {
            showCustom: vi.fn(async (options: any) => {
                if (!options.footer) return;
                const footer = document.createElement('footer');
                options.footer(footer, vi.fn());
                footer.querySelector<HTMLButtonElement>('[data-action="modal-confirm"]')?.click();
            }),
            alert: vi.fn(async () => undefined),
        };
        const workflow = new BookmarksCloudBackupWorkflow({
            getModalHost: () => modal as any,
            client: client as any,
        });

        await workflow.createSettingsActions().restore?.('googleDrive');

        expect(client.previewRestore).toHaveBeenCalledWith({
            provider: 'googleDrive',
            snapshotId: 'snapshot-1',
            strategy: 'safeMerge',
        });
        expect(client.applyRestore).toHaveBeenCalledWith({
            provider: 'googleDrive',
            snapshotId: 'snapshot-1',
            strategy: 'safeMerge',
            payloadHash: `sha256:${'a'.repeat(64)}`,
        });
        expect(modal.alert).toHaveBeenCalledWith(expect.objectContaining({ kind: 'info' }));
    });
});
