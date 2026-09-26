import type { CloudBackupAccountSummary, CloudBackupAuthStrategy, CloudBackupDiagnostics, CloudBackupSessionState, ProtocolErrorCode } from '../../../contracts/protocol';
import type { CloudBackupSnapshotSummary, CloudBackupSnapshot } from '../../../core/cloudBackup/types';

export class CloudBackupProviderError extends Error {
    constructor(public readonly code: ProtocolErrorCode, message: string) {
        super(message);
        this.name = 'CloudBackupProviderError';
    }
}

export type CloudBackupProvider = {
    getConfigurationStatus?(): { configured: boolean; message?: string };
    getDiagnostics?(): CloudBackupDiagnostics;
    getSessionState?(): CloudBackupSessionState;
    connect(): Promise<Partial<CloudBackupAccountSummary> & { authStrategy?: CloudBackupAuthStrategy }>;
    disconnect(): Promise<void>;
    uploadSnapshot(snapshot: CloudBackupSnapshot): Promise<CloudBackupSnapshotSummary>;
    listSnapshots(): Promise<CloudBackupSnapshotSummary[]>;
    downloadSnapshot(snapshotId: string): Promise<CloudBackupSnapshot>;
    deleteSnapshot(snapshotId: string): Promise<void>;
};
