import { describe, expect, it } from 'vitest';
import {
    createRichContentUrl, freezeRichBlocks, getRichBlockIdFromUrl, isRichBlocksV1,
    type RichBlockV1,
} from '@/contracts/richContent';

const sample: RichBlockV1 = {
    id: 'rich-1-ab', kind: 'svg', label: 'Diagram', fallbackMarkdown: '> [Diagram]',
    visualDigest: 'ab', source: { kind: 'svg', svg: '<svg/>', width: 120, height: 80 },
};

describe('portable rich content contracts', () => {
    it('validates bounded portable descriptors and refuses duplicate identities', () => {
        expect(isRichBlocksV1([sample])).toBe(true);
        expect(isRichBlocksV1([sample, sample])).toBe(false);
        expect(isRichBlocksV1([{ ...sample, source: { kind: 'dom-capture', surface: 'react-state' } }])).toBe(false);
        expect(isRichBlocksV1([{ ...sample, source: { kind: 'svg', svg: '<svg/>', width: Infinity } }])).toBe(false);
        expect(isRichBlocksV1([{ ...sample, id: '../outside' }])).toBe(false);
        expect(isRichBlocksV1(Array.from({ length: 3 }, (_, index) => ({ ...sample, id: `large-${index}`,
            source: { kind: 'svg', svg: 'x'.repeat(256_000) } })))).toBe(false);
    });

    it('whitelists fields while freezing so untrusted extra fields cannot retain DOM or caller objects', () => {
        const extra = document.createElement('div');
        const input = { ...sample, extra, source: { ...sample.source, extra } };
        const frozen = freezeRichBlocks([input]);
        expect(frozen[0]).toEqual(sample);
        expect(frozen[0]).not.toHaveProperty('extra');
        expect(frozen[0].source).not.toHaveProperty('extra');
        expect(Object.isFrozen(frozen)).toBe(true);
        expect(Object.isFrozen(frozen[0])).toBe(true);
        expect(Object.isFrozen(frozen[0].source)).toBe(true);
    });

    it('keeps the internal resource address grammar narrow', () => {
        expect(getRichBlockIdFromUrl(createRichContentUrl(sample.id))).toBe(sample.id);
        expect(getRichBlockIdFromUrl('https://example.com/image')).toBeNull();
        expect(getRichBlockIdFromUrl('aimd-rich:../x')).toBeNull();
        expect(getRichBlockIdFromUrl('aimd-rich:id?token=secret')).toBeNull();
    });
});
