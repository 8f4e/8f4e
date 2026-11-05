import type { EditorPlugin } from '@8f4e/editor-core';
import { installPresentation } from './presentation';

/** Presents contributed operations and keeps their visibility separate from retained state. */
export const loadingIndicatorsPlugin: EditorPlugin = {
	id: 'loading-indicators',
	setup: installPresentation,
};
