import type { RichBlockV1 } from '../../src/contracts/richContent';

export function richSvgBlock(overrides: Partial<RichBlockV1> = {}): RichBlockV1 {
    return {
        id: 'block-1', kind: 'svg', label: 'Diagram', fallbackMarkdown: '[Diagram]', visualDigest: 'visual-1',
        source: { kind: 'svg', svg: '<svg xmlns="http://www.w3.org/2000/svg"><rect fill="red"/></svg>' },
        ...overrides,
    };
}
