import {
    DEFAULT_FORMULA_SOURCE_FORMAT,
    normalizeFormulaSourceFormat,
    rewriteMarkdownFormulaSources,
    type FormulaSourceFormat,
} from '../../core/math/formulaSourceFormat';
import { copyTextToClipboard } from '../../drivers/content/clipboard/clipboard';
import { projectRichContentMarkdown } from '../content/richContentProjection';
import type { RichBlockV1 } from '../../contracts/richContent';

let markdownCopyFormulaFormat: FormulaSourceFormat = DEFAULT_FORMULA_SOURCE_FORMAT;

export function setCanonicalMarkdownCopyFormulaFormat(format: FormulaSourceFormat): void {
    markdownCopyFormulaFormat = normalizeFormulaSourceFormat(format);
}

export function formatCanonicalMarkdownForCopy(markdown: string, literal = false, richBlocks: readonly RichBlockV1[] = []): string {
    if (!literal && markdown.includes('aimd-rich:')) {
        const result = projectRichContentMarkdown(markdown, richBlocks);
        if (result.status !== 'ready' || result.kind !== 'rich-content') return '';
        markdown = result.markdown;
    }
    // Canonical Markdown already uses dollar-delimited math. Avoid reparsing the
    // synchronous default copy path unless the user requested another wrapper.
    if (literal || markdownCopyFormulaFormat === DEFAULT_FORMULA_SOURCE_FORMAT) return markdown;
    return rewriteMarkdownFormulaSources(markdown, markdownCopyFormulaFormat);
}

export function copyCanonicalMarkdownToClipboard(markdown: string, literal = false, richBlocks: readonly RichBlockV1[] = []): Promise<boolean> {
    return copyTextToClipboard(formatCanonicalMarkdownForCopy(markdown, literal, richBlocks));
}
