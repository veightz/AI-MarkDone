import { describe, expect, it } from 'vitest';
import type { Bookmark } from '../../../../src/core/bookmarks/types';
import { buildExportPayload } from '../../../../src/core/bookmarks/importExport';
import { buildCloudBackupRestorePlan, createCloudBackupSnapshot, hashCloudBackupPayload, validateCloudBackupSnapshot } from '../../../../src/core/cloudBackup/snapshot';

function bookmark(overrides: Partial<Bookmark> = {}): Bookmark {
    return {
        url: 'https://chatgpt.com/c/1',
        urlWithoutProtocol: 'chatgpt.com/c/1',
        position: 1,
        messageId: null,
        userMessage: 'hello',
        aiResponse: 'world',
        timestamp: 1,
        title: 'Hello',
        platform: 'ChatGPT',
        folderPath: 'Import',
        ...overrides,
    };
}

describe('cloud backup snapshot', () => {
    it('wraps the existing bookmarks export payload with a verifiable hash', async () => {
        const payload = buildExportPayload([bookmark()], true);
        const snapshot = await createCloudBackupSnapshot(payload, new Date('2026-05-08T12:00:00.000Z'));

        expect(snapshot.schemaVersion).toBe(2);
        expect(snapshot.app).toBe('AI-MarkDone');
        expect(snapshot.kind).toBe('bookmarks');
        expect(snapshot.payload.version).toBe('3.0');
        expect(snapshot.payloadHash).toMatch(/^sha256:/);

        const result = await validateCloudBackupSnapshot(snapshot);
        expect(result.snapshotId).toBe(snapshot.snapshotId);
    });

    it('rejects snapshots when the payload hash no longer matches', async () => {
        const payload = buildExportPayload([bookmark()], true);
        const snapshot = await createCloudBackupSnapshot(payload, new Date('2026-05-08T12:00:00.000Z'));
        snapshot.payload.bookmarks[0]!.title = 'Tampered';

        await expect(validateCloudBackupSnapshot(snapshot)).rejects.toThrow('INTEGRITY_MISMATCH');
    });

    it('accepts a valid version 1 wrapper with a 2.0 payload', async () => {
        const payload = { ...buildExportPayload([bookmark()], true), version: '2.0' as const };
        const snapshot = { schemaVersion: 1, app: 'AI-MarkDone', kind: 'bookmarks', snapshotId: 'old', createdAt: '2025-01-01T00:00:00.000Z', payloadHash: await hashCloudBackupPayload(payload), payload };

        await expect(validateCloudBackupSnapshot(snapshot)).resolves.toMatchObject({ schemaVersion: 1, snapshotId: 'old' });
    });

    it('safe-merges by message identity after ordinal and route changes', () => {
        const id = '12345678-1234-1234-1234-123456789abc';
        const local = bookmark({ url: `https://chatgpt.com/c/${id}`, position: 1, messageId: 'assistant-1' });
        const remote = bookmark({ url: `https://chatgpt.com/g/project/c/${id}`, position: 9, messageId: 'assistant-1' });

        const plan = buildCloudBackupRestorePlan({ localBookmarks: [local], remoteBookmarks: [remote], strategy: 'safeMerge' });

        expect(plan.bookmarksToUpsert).toEqual([]);
        expect(plan.conflictCount).toBe(1);
    });
});
