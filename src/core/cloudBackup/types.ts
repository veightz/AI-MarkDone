import type { Bookmark, ExportBookmark, ExportPayloadV2, ExportPayloadV3 } from '../bookmarks/types';
import type { HighlightBundle } from '../../contracts/highlights';
import type { ReaderAnnotationBundleV1 } from '../../contracts/readerAnnotations';
import type { MarkCatalog } from '../../contracts/markLibrary';

export type CloudBackupSnapshotV1 = {
    schemaVersion: 1;
    app: 'AI-MarkDone';
    kind: 'bookmarks';
    snapshotId: string;
    createdAt: string;
    payloadHash: string;
    payload: ExportPayloadV2;
};

export type CloudBackupSnapshotV2 = Omit<CloudBackupSnapshotV1, 'schemaVersion' | 'payload'> & {
    schemaVersion: 2;
    payload: ExportPayloadV3;
};

export type LibraryExportPayloadV4 = {
    version: '4.0';
    exportDate: string;
    bookmarks: ExportBookmark[];
    bookmarkFolders: string[];
    highlights: HighlightBundle[];
    annotations: ReaderAnnotationBundleV1[];
    markCatalog: MarkCatalog;
};

export type CloudBackupSnapshotV3 = Omit<CloudBackupSnapshotV2, 'schemaVersion' | 'kind' | 'payload'> & {
    schemaVersion: 3;
    kind: 'library';
    payload: LibraryExportPayloadV4;
};

export type CloudBackupSnapshot = CloudBackupSnapshotV1 | CloudBackupSnapshotV2 | CloudBackupSnapshotV3;

export type CloudBackupSnapshotSummary = {
    snapshotId: string;
    name: string;
    createdAt: string;
    size: number;
};

export type CloudBackupRestorePlan = {
    strategy: 'previewOnly' | 'safeMerge' | 'replaceLocal';
    bookmarksToUpsert: Bookmark[];
    localOnlyCount: number;
    duplicateCount: number;
    conflictCount: number;
    remoteCount: number;
    localCount: number;
};
