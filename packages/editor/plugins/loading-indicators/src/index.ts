import type { EditorPlugin } from '@8f4e/editor-core';
import { installCleanup } from './cleanup';
import { installPresentation } from './presentation';

/** Presents contributed operations and gradually expires results older than five seconds. */
export const loadingIndicatorsPlugin: EditorPlugin = {
	id: 'loading-indicators',
	setup: context => {
		const disposeCleanup = installCleanup(context.store);
		const disposePresentation = installPresentation(context);
		return () => {
			disposeCleanup();
			disposePresentation();
		};
	},
};
