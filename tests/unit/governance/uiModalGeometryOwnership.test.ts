import { describe, expect, it } from 'vitest';
import path from 'node:path';
import { collectUiStyleSources } from '../../support/uiStyleInventory';

describe('modal geometry ownership', () => {
    it('keeps viewport gutter calculations in one owner; families only supply size caps', () => {
        const owners = collectUiStyleSources(path.resolve(__dirname, '../../..'))
            .filter(({ source }) => /--_modal-(?:width|max-height)\s*:/.test(source))
            .map(({ relativePath }) => relativePath);
        expect(owners).toEqual(['src/ui/content/components/styles/modalHostCss.ts']);
    });
});
