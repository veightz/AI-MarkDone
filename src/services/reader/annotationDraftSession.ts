import { annotationDraftKey, type AnnotationDraftIdentity, type AnnotationDraftClient } from '../../contracts/annotationDrafts';

export type AnnotationDraftState = 'loading' | 'session' | 'saving' | 'saved' | 'failed' | 'conflict' | 'limit';
const recovery = new Map<string, AnnotationDraftSession>();

/** Owns recovery text independently from the annotation persistence preference. */
export class AnnotationDraftSession {
    readonly ready: Promise<void>;
    value = '';
    private revision = 0;
    private savedValue: string;
    private changed = false;
    private blocked = false;
    private loaded = false;
    private timer: ReturnType<typeof setTimeout> | null = null;
    private pending: Promise<boolean> = Promise.resolve(true);
    private state: AnnotationDraftState;
    private readonly recoveryKey: string | null;

    constructor(private readonly identity: AnnotationDraftIdentity | null, initialText: string,
        private readonly onState: (state: AnnotationDraftState) => void,
        onRestore: (text: string) => void,
        private readonly client: AnnotationDraftClient, runtimeKey?: string) {
        this.value = initialText;
        this.savedValue = initialText;
        this.state = identity ? 'loading' : 'session';
        const key = identity ? annotationDraftKey(identity) : runtimeKey ? `runtime:${runtimeKey}` : null;
        this.recoveryKey = key;
        const previous = key ? recovery.get(key) : undefined;
        if (key) recovery.set(key, this);
        // Only retire inactive memory entries. Durable drafts have their own bounded store.
        if (recovery.size > 100) {
            for (const [oldKey, session] of recovery) {
                if (session !== this && session.state === 'saved') { recovery.delete(oldKey); break; }
            }
        }
        this.ready = (async () => {
            await Promise.resolve();
            if (!identity) {
                if (previous && !this.changed) { this.value = previous.value; onRestore(this.value); }
                this.emit('session'); return;
            }
            if (previous && !(await previous.flush())) {
                this.revision = previous.revision;
                this.loaded = previous.loaded;
                if (!this.changed) { this.value = previous.value; onRestore(this.value); }
                this.changed = true;
                this.blocked = previous.blocked;
                this.emit(previous.state);
                return;
            }
            const result = await client.read(identity);
            if (!result.ok || !result.data) { this.emit('failed'); return; }
            this.loaded = true;
            this.revision = result.data.revision;
            this.savedValue = result.data.draft?.text ?? initialText;
            if (this.changed && result.data.draft && result.data.draft.text !== this.value) {
                this.blocked = true; this.emit('conflict'); return;
            }
            if (!this.changed && result.data.draft) { this.value = result.data.draft.text; onRestore(this.value); }
            this.emit(this.changed ? 'saving' : 'saved');
        })().catch(() => { this.emit('failed'); });
    }

    update(value: string): void {
        this.value = value;
        this.changed = true;
        if (this.timer) clearTimeout(this.timer);
        this.emit(this.blocked ? 'conflict' : this.identity ? 'saving' : 'session');
        this.timer = setTimeout(() => { this.timer = null; void this.flush(); }, 300);
    }

    flush(): Promise<boolean> {
        if (this.timer) clearTimeout(this.timer);
        this.timer = null;
        this.pending = this.pending.then(async () => {
            await this.ready;
            if (!this.identity) { this.emit('session'); return true; }
            if (!this.loaded) {
                const read = await this.client.read(this.identity);
                if (!read.ok || !read.data) { this.emit('failed'); return false; }
                this.revision = read.data.revision;
                this.loaded = true;
                if (read.data.draft && read.data.draft.text !== this.value) { this.blocked = true; this.emit('conflict'); return false; }
            }
            if (this.blocked) { this.emit('conflict'); return false; }
            if (!this.changed || this.value === this.savedValue) { this.emit('saved'); return true; }
            const value = this.value;
            const result = await this.client.write(this.identity, value, this.revision);
            if (!result.ok || !result.data) {
                const code = !result.ok ? result.errorCode : '';
                this.blocked = code === 'CONFLICT';
                this.emit(code === 'CONFLICT' ? 'conflict' : code === 'QUOTA_EXCEEDED' ? 'limit' : 'failed');
                return false;
            }
            this.revision = result.data.revision;
            this.savedValue = value;
            this.emit(this.value === value ? 'saved' : 'saving');
            return true;
        }).catch(() => { this.emit('failed'); return false; });
        return this.pending;
    }

    async discard(): Promise<boolean> {
        if (this.timer) clearTimeout(this.timer);
        this.timer = null;
        await this.ready;
        await this.pending;
        if (this.identity && !this.blocked) {
            if (!this.loaded) return false;
            const result = await this.client.remove(this.identity, this.revision);
            if (!result.ok && result.errorCode !== 'CONFLICT') { this.emit('failed'); return false; }
        }
        // Explicitly discarding a conflicted local draft must leave the other window's revision intact.
        if (this.recoveryKey && recovery.get(this.recoveryKey) === this) recovery.delete(this.recoveryKey);
        this.value = this.savedValue = '';
        this.changed = false;
        this.revision = 0;
        return true;
    }

    async clearSubmitted(value: string): Promise<boolean> {
        if (this.value !== value) return false;
        // Await any older write before compare-and-delete; a newer window's draft is never removed.
        await this.flush();
        if (this.value !== value) return false;
        return this.discard();
    }

    private emit(state: AnnotationDraftState): void { this.state = state; this.onState(state); }
}
