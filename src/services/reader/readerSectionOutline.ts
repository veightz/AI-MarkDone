import type { SemanticOutlineItemV1, SemanticReaderUnitV1 } from '../../contracts/semanticContent';

export type ReaderSectionOutlineItem = SemanticOutlineItemV1 & Readonly<{
    kind?: 'heading' | 'numbered' | 'chinese-section';
    badge?: string;
}>;

const ARABIC_SECTION_RE = /^(?:[（(])?(\d+)(?:[）)]|[.．、]|[ \t\u3000]+)(.+)$/u;
const CHINESE_SECTION_RE = /^([一二三四五六七八九十百千]+)[、．.]\s*(.*)$/u;

type DetectedSection = {
    kind: 'numbered' | 'chinese-section';
    badge: string;
    text: string;
    start: number;
    end: number;
    unitId?: string;
};

function normalizeSummary(raw: string): string {
    return raw.replace(/\s+/g, ' ').trim().slice(0, 48);
}

function matchSectionMarker(line: string): { kind: 'numbered' | 'chinese-section'; badge: string; text: string } | null {
    const trimmed = line.replace(/^\s+/, '');
    if (!trimmed) return null;
    const arabic = trimmed.match(ARABIC_SECTION_RE);
    if (arabic) {
        const badge = arabic[1]!;
        const rest = normalizeSummary(arabic[2] || '');
        return { kind: 'numbered', badge, text: rest || badge };
    }
    const chinese = trimmed.match(CHINESE_SECTION_RE);
    if (chinese) {
        const badge = chinese[1]!;
        const rest = normalizeSummary(chinese[2] || '');
        return { kind: 'chinese-section', badge, text: rest ? `${badge}、${rest}` : `${badge}、` };
    }
    return null;
}

function firstLine(source: string): string {
    const line = source.split(/\r?\n/, 1)[0] ?? source;
    return line.trimEnd();
}

function detectFromUnits(units: readonly SemanticReaderUnitV1[]): DetectedSection[] {
    const out: DetectedSection[] = [];
    for (const unit of units) {
        if (unit.kind !== 'list-item' && unit.kind !== 'heading') continue;
        if (unit.kind === 'heading') continue; // headings already in outline
        const marker = matchSectionMarker(firstLine(unit.source));
        if (!marker) continue;
        out.push({
            ...marker,
            start: unit.start,
            end: unit.end,
            unitId: unit.id,
        });
    }
    return out;
}

/**
 * Scan markdown source for block-leading numbered / 「一、」 sections that are
 * not already covered by heading outline or list-item units.
 */
function detectFromSource(
    markdown: string,
    coveredStarts: ReadonlySet<number>,
): DetectedSection[] {
    const out: DetectedSection[] = [];
    let offset = 0;
    const lines = markdown.split(/\r?\n/);
    let inFence = false;

    for (let i = 0; i < lines.length; i += 1) {
        const line = lines[i]!;
        const lineStart = offset;
        offset += line.length + (i < lines.length - 1 ? 1 : 0);

        const fence = line.trimStart().startsWith('```');
        if (fence) {
            inFence = !inFence;
            continue;
        }
        if (inFence) continue;

        // Block start: previous line blank or BOF; skip ATX headings / list markers handled via units.
        const prevBlank = i === 0 || !(lines[i - 1] ?? '').trim();
        if (!prevBlank) continue;
        if (/^\s{0,3}#{1,6}\s/.test(line)) continue;

        const marker = matchSectionMarker(line);
        if (!marker) continue;
        if (coveredStarts.has(lineStart)) continue;

        // Skip GFM ordered-list lines — those are matched via list-item units.
        if (/^\s*\d+\.\s+/.test(line)) continue;

        out.push({
            ...marker,
            start: lineStart,
            end: lineStart + line.length,
        });
    }
    return out;
}

function overlapsHeading(section: DetectedSection, headings: readonly SemanticOutlineItemV1[]): boolean {
    return headings.some((heading) => (
        section.start >= heading.start && section.start < heading.end
    ) || (
        Math.abs(section.start - heading.start) <= 1
    ));
}

/**
 * Merge heading outline with Arabic / Chinese section markers.
 * Numbered groups need at least 2 items to appear.
 */
export function mergeReaderSectionOutline(params: {
    markdown: string;
    headingOutline: readonly SemanticOutlineItemV1[];
    units: readonly SemanticReaderUnitV1[];
}): ReaderSectionOutlineItem[] {
    const { markdown, headingOutline, units } = params;
    const fromUnits = detectFromUnits(units);
    const covered = new Set<number>([
        ...headingOutline.map((item) => item.start),
        ...fromUnits.map((item) => item.start),
    ]);
    const fromSource = detectFromSource(markdown, covered);
    const sections = [...fromUnits, ...fromSource]
        .filter((section) => !overlapsHeading(section, headingOutline))
        .sort((a, b) => a.start - b.start);

    const numbered = sections.filter((s) => s.kind === 'numbered');
    const chinese = sections.filter((s) => s.kind === 'chinese-section');
    const emitNumbered = numbered.length >= 2;
    const emitChinese = chinese.length >= 2;
    const accepted = sections.filter((s) => (
        (s.kind === 'numbered' && emitNumbered) || (s.kind === 'chinese-section' && emitChinese)
    ));

    let syntheticCounter = 0;
    const sectionItems: ReaderSectionOutlineItem[] = accepted.map((section) => {
        const id = section.unitId ?? `aimd-section-outline-${++syntheticCounter}`;
        return Object.freeze({
            id,
            level: 2,
            text: section.text,
            start: section.start,
            end: section.end,
            kind: section.kind,
            badge: section.badge,
        });
    });

    const merged: ReaderSectionOutlineItem[] = [
        ...headingOutline.map((item) => Object.freeze({
            ...item,
            kind: item.kind ?? 'heading' as const,
            badge: item.badge ?? `H${Math.max(1, Math.min(6, Math.round(item.level)))}`,
        })),
        ...sectionItems,
    ].sort((a, b) => a.start - b.start || a.end - b.end);

    // Dedupe identical start positions preferring headings.
    const seenStarts = new Set<number>();
    const deduped: ReaderSectionOutlineItem[] = [];
    for (const item of merged) {
        if (seenStarts.has(item.start)) continue;
        seenStarts.add(item.start);
        deduped.push(item);
    }
    return deduped;
}

/**
 * Stamp `data-aimd-outline-id` on paragraph / list-item nodes that match
 * synthetic section outline items (those without a pre-existing unit id stamp).
 */
export function stampReaderSectionOutlineAnchors(
    root: ParentNode,
    outlineItems: readonly ReaderSectionOutlineItem[],
): void {
    const synthetic = outlineItems.filter((item) => (
        (item.kind === 'numbered' || item.kind === 'chinese-section')
        && item.id.startsWith('aimd-section-outline-')
    ));
    if (synthetic.length === 0) return;

    const blocks = Array.from(root.querySelectorAll<HTMLElement>('p, li')).filter((el) => {
        // Prefer leaf-ish content blocks; skip nested list wrappers' outer li when it has nested lists only? keep simple.
        return Boolean(el.textContent?.trim());
    });

    let searchStart = 0;
    for (const item of synthetic) {
        for (let i = searchStart; i < blocks.length; i += 1) {
            const el = blocks[i]!;
            const text = (el.textContent || '').replace(/\s+/g, ' ').trim();
            const marker = matchSectionMarker(text);
            if (!marker) continue;
            if (marker.kind !== item.kind) continue;
            if (marker.badge !== item.badge) continue;
            el.setAttribute('data-aimd-outline-id', item.id);
            searchStart = i + 1;
            break;
        }
    }
}
