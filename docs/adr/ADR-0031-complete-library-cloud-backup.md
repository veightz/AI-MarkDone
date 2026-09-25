# ADR-0031 Complete Library Cloud Backup

## Status

Accepted for implementation, 2026-09-25. The current shipped code still creates bookmark-only snapshots until this decision is implemented.

## Context

Google Drive backup currently saves bookmarks alone. The Library now also contains durable highlights, durable annotations, and a separate catalog of folders and conversation names. Restoring only bookmarks can leave most of a user's Library behind. Existing snapshot versions 1 and 2 and the bookmark-only local JSON export must remain readable. The extension has no transaction spanning browser storage and Google Drive, so restore must fail closed before destructive writes and retain a recoverable local copy.

## Decision

1. A new, immutable cloud snapshot version 3 contains the existing bookmark export payload, complete validated highlight and annotation bundles, and the validated mark-folder catalog. It is hashed as one payload, uploaded through the existing provider, and read back for verification. No new OAuth scope, automatic sync, startup migration, or page/API data collection is introduced. Runtime-only annotations, settings, Prompt Library, and conversation bodies outside saved bookmarks are excluded. The bookmark-only local import/export format remains unchanged.
2. Capture all local domains under the background storage queue. If an indexed bookmark, mark bundle, or catalog cannot be read and validated, backup fails rather than uploading an incomplete snapshot. Snapshot validation rejects malformed sections, duplicate record identities, mismatched document keys, and a broken folder tree before restore can write anything.
3. Snapshot versions 1 and 2 remain accepted. Restoring either version affects bookmarks only, including under the explicit replace strategy; it never clears highlights, annotations, or mark folders. New version 3 restores all four domains.
4. The default safe merge never propagates cloud deletions and never overwrites a local record with the same identity. Highlight and annotation identity is conversation plus record ID; different local content is a conflict, and remote-only records are added. Folder merge maps matching parent/name paths onto local folders, imports remote-only folders with stable or remapped IDs, and keeps local conversation metadata on conflict. Remote-only conversation metadata follows the mapped folder. A folder collision cannot cause records to be dropped or overwrite a local folder.
5. Explicit replace uses a full local emergency snapshot written and verified before any old Library key is removed. It preflights all remote data and quota, writes replacement records before removing obsolete keys, and leaves the emergency snapshot available for recovery if a storage write fails. It preserves the existing preview/confirmation boundary. The normal Settings flow still offers safe merge only.
6. Drive keeps the existing `AI-MarkDone/Backups/bookmarks` directory and old filename discovery so prior backups remain visible; new files are distinguishable by snapshot version in their contents and user-facing restore preview. The UI names the backed-up domains and shows per-domain counts before applying a restore. The user is told that saved annotations and highlights are now included in the authorized Drive backup.

## Consequences

- Cloud snapshots contain user-written annotation text and selected excerpts, so the backup copy and privacy text must accurately disclose the expanded scope.
- The background owns all persistent reads and writes; content and Reader continue to use their existing stores and revision contracts.
- Tests must cover v1/v2 bookmark-only restoration, v3 round-trip, corrupt/missing local data, hash mismatch, merge conflicts, folder ID/name collisions, replacement recovery, quota/write failure, and Chrome/Firefox provider and UI flows. A build or fixture alone does not prove a manually reloaded extension against a real profile.
