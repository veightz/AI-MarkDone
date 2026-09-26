import css from './libraryWorkspace.css?inline';
import { getHighlightSwatchesCss } from '../../../components/HighlightSwatches';

export function getLibraryWorkspaceCss(): string { return css + getHighlightSwatchesCss(); }
