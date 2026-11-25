import type { EditorPlugin } from '@8f4e/editor-core';
import { DEFAULT_FONT, FONT_NAMES, type Font } from '@8f4e/sprite-generator';
import { getAppearanceFont } from '@8f4e/web-ui';
import { installFontNotice } from './notice';

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
		setup: context => {
			const { store } = context;
			const state = store.getState();
			const disposeNotice = installFontNotice(context);
			const resetPreview = () => {
				if (state.appearance.fontOverride !== undefined) store.set('appearance.fontOverride', undefined);
			};
			const onProjectChange = () => {
				if (state.projectChange.kind === 'replace') resetPreview();
			};
			const onKeydown = (event: KeyboardEvent) => {
				if (event.defaultPrevented || event.altKey || !(event.ctrlKey || event.metaKey)) return;
				const direction = event.key === '-' ? -1 : event.key === '+' || event.key === '=' ? 1 : 0;
				if (!direction) return;
				event.preventDefault();
				const currentFont = getAppearanceFont(state, defaultFont);
				const nextIndex = FONT_NAMES.indexOf(currentFont) + direction;
				const previewFont = FONT_NAMES[nextIndex];
				if (previewFont !== undefined) store.set('appearance.fontOverride', previewFont);
			};
			// Use the settled replacement's font, not the outgoing project's configuration.
			store.subscribe('projectChange', onProjectChange);
			inputTarget.addEventListener('keydown', onKeydown);
			return () => {
				disposeNotice();
				inputTarget.removeEventListener('keydown', onKeydown);
				store.unsubscribe('projectChange', onProjectChange);
				resetPreview();
			};
		},
	};
}
