import type { EditorPlugin } from '@8f4e/editor-core';
import { getExportBaseName } from '@8f4e/editor-state';
import { saveScreenshot } from './saveScreenshot';

const action = 'exportCanvasScreenshot';

export function createScreenshotPlugin({
	canvas,
	renderFrame,
}: {
	canvas: HTMLCanvasElement;
	/** Called by screenshot actions after editor initialization. */
	renderFrame: () => void;
}): EditorPlugin {
	return {
		id: 'screenshot',
		setup: ({ store, events, menus }) => {
			const state = store.getState();
			const unregisterMenuItem = menus.registerItem('mainMenu', () => ({
				title: 'Take Screenshot',
				action,
				close: true,
			}));
			const onScreenshot = async () => {
				const { modeOverlay, offscreenBlockArrows } = state.featureFlags;
				const fileName = `${getExportBaseName(state)}.png`;
				try {
					store.set('featureFlags.modeOverlay', false);
					store.set('featureFlags.offscreenBlockArrows', false);
					renderFrame();
					await saveScreenshot(canvas, fileName);
				} catch (error) {
					console.error('Failed to export canvas screenshot:', error);
				} finally {
					store.set('featureFlags.modeOverlay', modeOverlay);
					store.set('featureFlags.offscreenBlockArrows', offscreenBlockArrows);
				}
			};
			events.on(action, onScreenshot);
			return () => {
				events.off(action, onScreenshot);
				unregisterMenuItem();
			};
		},
	};
}
