import type { ReaderSessionAssetsResultV1, ReaderSessionSerializableItem } from '../../contracts/protocol';
import { isRichBlocksV1 } from '../../contracts/richContent';
import { cloneRichAssetRelayRef } from '../../contracts/richContentAssets';
import { prepareRichContentAssets, resolveRichContentMessageRoot } from '../../drivers/content/export/richContentAssets';
import { retainRichContentAssets, type RichAssetRelayLease } from '../export/richAssetRelayClient';

type Job = { controller: AbortController; lease: RichAssetRelayLease | null };

/** Owns only cancellable asset capabilities, never another discovered content pool. */
export class ReaderRichAssetSessions {
    private readonly sessions = new Map<string, Map<string, Job>>();

    constructor(private readonly dependencies = { prepare: prepareRichContentAssets, retain: retainRichContentAssets }) {}

    async prepare(sessionId: string, item: ReaderSessionSerializableItem, sourceUrl: string, leaseId: string): Promise<ReaderSessionAssetsResultV1> {
        if (!isRichBlocksV1(item.richBlocks ?? [])) throw new Error('Invalid Reader rich content');
        let jobs = this.sessions.get(sessionId);
        if (!jobs) { jobs = new Map(); this.sessions.set(sessionId, jobs); }
        if (jobs.has(leaseId) || jobs.size >= 8) throw new Error('Reader asset lease limit exceeded');
        const job: Job = { controller: new AbortController(), lease: null };
        jobs.set(leaseId, job);
        const current = () => !job.controller.signal.aborted && this.sessions.get(sessionId)?.get(leaseId) === job;
        const context = { messageId: item.meta?.assistantMessageId || item.meta?.messageId || undefined, documentUrl: item.meta?.url || sourceUrl };
        let prepared: Awaited<ReturnType<typeof prepareRichContentAssets>> | null = null;
        try {
            prepared = await this.dependencies.prepare(item.richBlocks ?? [], {
                ...context, signal: job.controller.signal, deadlineMs: Date.now() + 8_000,
                resolveMessageRoot: () => resolveRichContentMessageRoot(context),
            });
            if (!current()) throw new DOMException('Reader asset session closed', 'AbortError');
            const assets = (item.richBlocks ?? []).flatMap(block => {
                const variants = prepared!.assets.filter(asset => asset.blockId === block.id && asset.visualDigest === block.visualDigest);
                const asset = variants.find(candidate => candidate.mimeType === 'image/png') ?? variants[0];
                return asset ? [asset] : [];
            });
            if (!assets.length) { jobs.delete(leaseId); return { version: 1, leaseId: null, refs: [] }; }
            const relay = await this.dependencies.retain(assets, { leaseId, signal: job.controller.signal });
            if (!current()) { await relay.release(); throw new DOMException('Reader asset session closed', 'AbortError'); }
            job.lease = relay;
            return { version: 1, leaseId: relay.leaseId, refs: Object.freeze(relay.refs.map(cloneRichAssetRelayRef)) };
        } catch (error) {
            jobs.delete(leaseId);
            throw error;
        } finally { prepared?.release(); }
    }

    async release(sessionId: string, leaseId?: string): Promise<void> {
        const jobs = this.sessions.get(sessionId);
        if (!jobs) return;
        const ids = leaseId ? [leaseId] : Array.from(jobs.keys());
        if (!leaseId) this.sessions.delete(sessionId);
        for (const id of ids) {
            const job = jobs.get(id);
            if (!job) continue;
            jobs.delete(id);
            job.controller.abort();
            await job.lease?.release();
        }
    }

    async dispose(): Promise<void> {
        await Promise.allSettled(Array.from(this.sessions.keys()).map(sessionId => this.release(sessionId)));
    }
}
