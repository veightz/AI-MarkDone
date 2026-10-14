import { createRequestId, PROTOCOL_VERSION } from '../../../contracts/protocol';
import type { AnnotationDraft, AnnotationDraftIdentity } from '../../../contracts/annotationDrafts';
import { requestRuntimeClient } from './clientResult';

export const annotationDraftsClient = {
    read(identity: AnnotationDraftIdentity) {
        return requestRuntimeClient<{ draft: AnnotationDraft | null; revision: number }>({ v: PROTOCOL_VERSION, id: createRequestId(), type: 'annotations:draftRead', payload: { identity } });
    },
    write(identity: AnnotationDraftIdentity, text: string, expectedRevision: number) {
        return requestRuntimeClient<{ revision: number }>({ v: PROTOCOL_VERSION, id: createRequestId(), type: 'annotations:draftWrite', payload: { identity, text, expectedRevision } });
    },
    remove(identity: AnnotationDraftIdentity, expectedRevision: number) {
        return requestRuntimeClient<{ revision: number }>({ v: PROTOCOL_VERSION, id: createRequestId(), type: 'annotations:draftRemove', payload: { identity, expectedRevision } });
    },
};
