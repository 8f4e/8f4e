import type { EditorPlugin } from '@8f4e/editor-core';
import { resolveEditorConfig } from '@8f4e/editor-state';
import { DEFAULT_FONT, FONT_NAMES, type Font } from '@8f4e/sprite-generator';

/** Preview fonts without modifying project source or history. */
export function createFontPreviewPlugin({
	inputTarget,
	defaultFont = DEFAULT_FONT,
}: {
	inputTarget: HTMLElement;
	/** Match the renderer's per-editor default when source has no font directive. */
	defaultFont?: Font;
}): EditorPlugin {
	return {
		id: 'font-preview',
		setup: ({ store, events }) => {
			const state = store.getState();
			let previewFont: Font | undefined;
			const retainPreview = () => {
				if (previewFont !== undefined && state.editorConfig.font !== previewFont) {
					store.set('editorConfig.font', previewFont);
				}
			};
			const resetPreview = () => {
				previewFont = undefined;
			};
			const onKeydown = (event: KeyboardEvent) => {
				if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
				const direction = event.key === 'F18' ? -1 : event.key === 'F19' ? 1 : 0;
				if (!direction) return;
				event.preventDefault();
				const currentFont = (state.editorConfig.font as Font | undefined) ?? defaultFont;
				previewFont = FONT_NAMES[(FONT_NAMES.indexOf(currentFont) + direction + FONT_NAMES.length) % FONT_NAMES.length];
				store.set('editorConfig.font', previewFont);
			};
			store.subscribe('editorConfig.font', retainPreview);
			// Clear before project-loading listeners resolve the replacement project's configuration.
			events.on('loadProject', resetPreview, { capture: true });
			inputTarget.addEventListener('keydown', onKeydown);
			return () => {
				inputTarget.removeEventListener('keydown', onKeydown);
				events.off('loadProject', resetPreview);
				store.unsubscribe('editorConfig.font', retainPreview);
				if (previewFont !== undefined) resolveEditorConfig(store);
			};
		},
	};
}
