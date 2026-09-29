import { describe, expect, it } from 'vitest';
import {
    mergeReaderSectionOutline,
    stampReaderSectionOutlineAnchors,
} from '@/services/reader/readerSectionOutline';
import type { SemanticOutlineItemV1, SemanticReaderUnitV1 } from '@/contracts/semanticContent';

describe('mergeReaderSectionOutline', () => {
    it('merges headings with arabic and chinese section markers', () => {
        const headingOutline: SemanticOutlineItemV1[] = [
            { id: 'h1', level: 2, text: 'Overview', start: 0, end: 12 },
        ];
        const markdown = [
            '## Overview',
            '',
            '1、背景',
            '',
            '2、方案',
            '',
            '一、准备',
            '',
            '二、落地',
        ].join('\n');
        const merged = mergeReaderSectionOutline({
            markdown,
            headingOutline,
            units: [],
        });
        expect(merged.map((item) => item.badge)).toEqual(
            expect.arrayContaining(['H2', '1', '2', '一', '二']),
        );
        expect(merged.some((item) => item.kind === 'numbered')).toBe(true);
        expect(merged.some((item) => item.kind === 'chinese-section')).toBe(true);
    });

    it('reuses list-item unit ids when markers come from units', () => {
        const units: SemanticReaderUnitV1[] = [
            {
                id: 'unit-1',
                kind: 'list-item',
                mode: 'structural',
                start: 0,
                end: 6,
                source: '1. Alpha',
            },
            {
                id: 'unit-2',
                kind: 'list-item',
                mode: 'structural',
                start: 7,
                end: 13,
                source: '2. Beta',
            },
        ];
        const merged = mergeReaderSectionOutline({
            markdown: '1. Alpha\n2. Beta',
            headingOutline: [],
            units,
        });
        expect(merged.map((item) => item.id)).toEqual(['unit-1', 'unit-2']);
        expect(merged.every((item) => item.kind === 'numbered')).toBe(true);
    });
});

describe('stampReaderSectionOutlineAnchors', () => {
    it('stamps synthetic section outline ids onto matching paragraphs', () => {
        document.body.innerHTML = '<div id="root"><p>一、准备</p><p>二、执行</p></div>';
        const root = document.getElementById('root')!;
        stampReaderSectionOutlineAnchors(root, [
            {
                id: 'aimd-section-outline-1',
                level: 2,
                text: '一、准备',
                start: 0,
                end: 4,
                kind: 'chinese-section',
                badge: '一',
            },
            {
                id: 'aimd-section-outline-2',
                level: 2,
                text: '二、执行',
                start: 5,
                end: 9,
                kind: 'chinese-section',
                badge: '二',
            },
        ]);
        expect(root.querySelectorAll('[data-aimd-outline-id]')).toHaveLength(2);
        expect(root.querySelector('[data-aimd-outline-id="aimd-section-outline-1"]')?.textContent).toContain('准备');
    });
});
