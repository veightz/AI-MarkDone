import type { RichBlockV1, RichContentReplacementV1 } from '../../contracts/richContent';
import type { SemanticProjectionOutcomeV1 } from '../../contracts/semanticContent';
import { createCanonicalMarkdownSource, semanticContent } from '../semantic-content/SemanticContent';

/** Output-only projection: resource substitution never mutates the captured canonical source or its source spans. */
export function projectRichContentMarkdown(
    source: string,
    blocks: readonly RichBlockV1[],
    options: Readonly<{
        key?: string;
        revision?: string;
        replacements?: readonly RichContentReplacementV1[];
    }> = {},
): SemanticProjectionOutcomeV1 {
    const compiled = semanticContent.compile(createCanonicalMarkdownSource(source, {
        key: options.key,
        revision: options.revision,
        producer: 'rich-content-projection',
    }));
    if (compiled.status !== 'ready') return { status: 'rejected', kind: 'rich-content', diagnostics: compiled.diagnostics };
    const replacements = new Map(blocks.map(block => [block.id, block.fallbackMarkdown]));
    for (const replacement of options.replacements ?? []) {
        if (replacements.has(replacement.id)) replacements.set(replacement.id, replacement.markdown);
    }
    return semanticContent.project(compiled.document, {
        kind: 'rich-content',
        replacements: [...replacements].map(([id, markdown]) => ({ id, markdown })),
    });
}
