import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { sanitizeLightweightSvg } from '@/drivers/content/export/sanitizeLightweightSvg';

describe('self-contained SVG currentColor closure', () => {
    it('keeps the native DIL diagram as SVG by freezing its explicit local color', () => {
        // Reduced from the inspected native-diagram.svg; retain the observed root color and inherited paint structure.
        const source = readFileSync('tests/testdata/chatgpt/native-svg-current-color.svg', 'utf8');
        const result = sanitizeLightweightSvg(source);
        expect(result.kind).toBe('ready');
        if (result.kind !== 'ready') return;
        expect(result).toMatchObject({ width: 340, height: 208 });
        expect(result.svg).not.toMatch(/currentcolor/i);
        const parsed = new DOMParser().parseFromString(result.svg, 'image/svg+xml');
        expect(parsed.documentElement.getAttribute('fill')).toBe('rgb(13, 13, 13)');
        expect(parsed.querySelector('g')?.getAttribute('fill')).toBe('rgb(13, 13, 13)');
        expect(parsed.querySelector('path')?.getAttribute('stroke')).toBe('rgb(13, 13, 13)');
        expect(parsed.querySelector('text')?.textContent).toBe('ISAC BS');
        expect(result.svg).toContain('阵列发射');
    });

    it('resolves an explicit color on an SVG ancestor without consulting the page body', () => {
        document.body.style.color = 'rgb(255, 0, 255)';
        const result = sanitizeLightweightSvg('<svg viewBox="0 0 20 10"><g color="#0d9488"><path fill="currentColor" d="M0 0L20 10"/></g></svg>');
        expect(result.kind).toBe('ready');
        if (result.kind !== 'ready') return;
        expect(result.svg).toContain('fill="rgb(13, 148, 136)"');
        expect(result.svg).not.toContain('255, 0, 255');
    });

    it('closes simple inline paint declarations and keeps their priority', () => {
        const result = sanitizeLightweightSvg('<svg color="blue" viewBox="0 0 20 10"><path style="fill:currentColor!important;stroke:currentColor" d="M0 0L20 10"/></svg>');
        expect(result.kind).toBe('ready');
        if (result.kind !== 'ready') return;
        expect(result.svg).not.toMatch(/currentcolor/i);
        expect(result.svg).toContain('fill: blue !important');
        expect(result.svg).toContain('stroke: blue');
    });

    it.each([
        '<svg><path fill="currentColor"/></svg>',
        '<svg style="color:var(--host-color)"><path fill="currentColor"/></svg>',
        '<svg class="host-color" color="red"><path fill="currentColor"/></svg>',
        '<svg color="red"><style>path{color:blue!important}</style><path fill="currentColor"/></svg>',
        '<svg color="CanvasText"><path fill="currentColor"/></svg>',
        '<svg color="red"><path style="filter:drop-shadow(0 0 2px currentColor)"/></svg>',
        '<svg fill="currentColor" color="red"><g color="blue"><path/></g></svg>',
    ])('keeps unresolved or complex CSS on the bitmap fallback path', source => {
        expect(sanitizeLightweightSvg(source)).toEqual({ kind: 'unavailable', reason: 'unsupported' });
    });

    it.each([
        '<svg color="red" onload="alert(1)"><path fill="currentColor"/></svg>',
        '<svg style="color:url(https://example.com/paint)"><path fill="currentColor"/></svg>',
        '<!DOCTYPE svg [<!ENTITY x "red">]><svg color="red"><path fill="currentColor"/></svg>',
    ])('validates source safety before any fixed-color replacement', source => {
        expect(sanitizeLightweightSvg(source)).toEqual({ kind: 'unavailable', reason: 'unsafe-resource' });
    });
});
