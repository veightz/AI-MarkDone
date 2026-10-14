import type { ChatTurn, ConversationMetadata, TranslateFn } from './saveMessagesTypes';
import { buildMessageExportDocument } from './messageExportDocument';
import { sanitizeExportFilename } from './saveMessagesDocument';
import { projectRichContentMarkdown } from '../content/richContentProjection';
import {
    DEFAULT_FORMULA_SOURCE_FORMAT,
    normalizeFormulaSourceFormat,
    rewriteMarkdownFormulaSources,
    type FormulaSourceFormat,
} from '../../core/math/formulaSourceFormat';

export type MarkdownExportResult = {
    filename: string;
    markdown: string;
};

function sanitizeMarkdownHeading(text: string): string {
    const out =
        (text || 'Conversation')
            .replace(/[\r\n]+/g, ' ')
            .replace(/^#+\s*/, '')
            .trim()
            .substring(0, 200) || 'Conversation';
    return out;
}

export function buildMarkdownExport(
    turns: ChatTurn[],
    selectedIndices: number[],
    metadata: ConversationMetadata,
    t: TranslateFn,
    options: { formulaFormat?: FormulaSourceFormat } = {},
): MarkdownExportResult | null {
    const document = buildMessageExportDocument(turns, selectedIndices, {
        title: metadata.title,
        labels: { user: t('exportUserLabel'), assistant: t('exportAssistantLabel') },
        formatHeading: (ordinal) => t('exportMessagePrefix', `${ordinal}`),
    });
    if (!document) return null;

    const markdownTitle = sanitizeMarkdownHeading(metadata.title);
    let markdown = `# ${markdownTitle}\n\n`;
    markdown += `> ${t('exportMetadata', [metadata.platform, new Date(metadata.exportedAt).toLocaleString()])}\n\n`;

    const formulaFormat = normalizeFormulaSourceFormat(options.formulaFormat ?? DEFAULT_FORMULA_SOURCE_FORMAT);
    document.sections.forEach((section, i) => {
        if (i > 0) {
            markdown += `\n---\n\n`;
        }
        markdown += `# ${section.heading}\n\n`;
        markdown += `## ${document.labels.user}\n\n${rewriteMarkdownFormulaSources(section.userText, formulaFormat)}\n\n`;
        let body = section.assistantMarkdown;
        if (body.includes('aimd-rich:')) {
            const projection = projectRichContentMarkdown(body, section.richBlocks ?? []);
            if (projection.status !== 'ready' || projection.kind !== 'rich-content') throw new Error('Rich content projection is unavailable.');
            body = projection.markdown;
        }
        markdown += `## ${document.labels.assistant}\n\n${rewriteMarkdownFormulaSources(body, formulaFormat)}\n\n`;
    });

    return {
        filename: `${sanitizeExportFilename(metadata.title)}.md`,
        markdown,
    };
}
