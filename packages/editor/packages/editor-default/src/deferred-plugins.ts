import type { EditorPlugin } from '@8f4e/editor-core';
import type { ProjectFileSession } from '@8f4e/editor-file-session';
import { createLazyPluginLoaderPlugin } from '@8f4e/editor-plugin-lazy-loader';
import { INPUT_LAYERS } from '@8f4e/editor-state-types';
import type { createDefaultEditorPlugins } from './index';
import { createLazyPluginRegistry } from './lazy-plugins';

export function createDeferredEditorPlugin(
	options: Parameters<typeof createDefaultEditorPlugins>[0] & { fileSession: ProjectFileSession }
): EditorPlugin {
	const { canvas, fileSession, includeKeyboardModeSwitching = true } = options;
	const browserWindow = canvas.ownerDocument.defaultView!;
	const motionPreference = browserWindow.matchMedia('(prefers-reduced-motion: reduce)');
	const hasCoarsePointer = browserWindow.matchMedia('(pointer: coarse)').matches;
	return createLazyPluginLoaderPlugin([
		{
			id: 'offscreen-block-arrows',
			scope: 'view',
			matches: () => true,
			load: () =>
				import('@8f4e/editor-plugin-offscreen-block-arrows').then(module => module.offscreenBlockArrowsPlugin),
		},
		{
			id: 'entry-outlines',
			scope: 'view',
			matches: () => true,
			load: () => import('@8f4e/editor-plugin-entry-outlines').then(module => module.entryOutlinesPlugin),
		},
		{
			id: 'context-menu',
			scope: 'view',
			matches: () => true,
			load: () => import('@8f4e/editor-plugin-context-menu').then(module => module.contextMenuPlugin),
		},
		{
			id: 'error-messages',
			scope: 'view',
			matches: () => true,
			load: () => import('@8f4e/editor-plugin-error-messages').then(module => module.errorMessagesPlugin),
		},
		{
			id: 'jump-to-error',
			scope: 'view',
			matches: () => true,
			load: () =>
				import('@8f4e/editor-plugin-jump-to-error').then(module =>
					module.createJumpToErrorPlugin({ layer: INPUT_LAYERS.canvasOverlay })
				),
		},
		{
			id: 'dialogs',
			scope: 'view',
			matches: () => true,
			load: () => import('@8f4e/editor-plugin-dialogs').then(module => module.dialogsPlugin),
		},
		{
			id: 'pwa-updates',
			scope: 'view',
			matches: () => options.pwaUpdates !== undefined,
			load: () =>
				import('@8f4e/editor-plugin-pwa-updates').then(module =>
					module.createPwaUpdatesPlugin({ serviceWorker: options.pwaUpdates! })
				),
		},
		// {
		// 	id: 'selection-animation',
		// 	scope: 'view',
		// 	matches: () => true,
		// 	load: () => import('@8f4e/editor-plugin-selection-animation').then(module => module.selectionAnimationPlugin),
		// },
		{
			id: 'connectors',
			scope: 'view',
			matches: () => true,
			load: () => import('@8f4e/editor-plugin-connectors').then(module => module.connectorsPlugin),
		},
		{
			id: 'assertion-markers',
			scope: 'view',
			matches: () => true,
			load: () => import('@8f4e/editor-plugin-assertion-markers').then(module => module.assertionMarkersPlugin),
		},
		{
			id: 'tooltips',
			scope: 'view',
			matches: () => true,
			load: () => import('@8f4e/editor-plugin-tooltips').then(module => module.tooltipsPlugin),
		},
		{
			id: 'project-save',
			scope: 'view',
			matches: () => true,
			load: () =>
				import('@8f4e/editor-plugin-project-save').then(module =>
					module.createProjectSavePlugin({ inputTarget: canvas, fileSession })
				),
		},
		{
			id: 'code-block-copy-paste',
			scope: 'view',
			matches: () => true,
			load: () =>
				import('@8f4e/editor-plugin-code-block-copy-paste').then(module =>
					module.createCodeBlockCopyPastePlugin({
						readClipboardText: () => browserWindow.navigator.clipboard.readText(),
						writeClipboardText: text => browserWindow.navigator.clipboard.writeText(text),
					})
				),
		},
		{
			id: 'mouse-input',
			scope: 'view',
			matches: () => true,
			load: () =>
				import('@8f4e/editor-plugin-mouse-input').then(module =>
					module.createMouseInputPlugin({ inputTarget: canvas, captureWheel: options.captureWheel })
				),
		},
		{
			id: 'touch-input',
			scope: 'view',
			matches: () => hasCoarsePointer,
			load: () =>
				import('@8f4e/editor-plugin-touch-input').then(module =>
					module.createTouchInputPlugin({ ...options.touchNavigation, inputTarget: canvas })
				),
		},
		{
			id: 'keyboard-navigation',
			scope: 'view',
			matches: () => !hasCoarsePointer,
			load: () =>
				import('@8f4e/editor-plugin-keyboard-navigation').then(module =>
					module.createKeyboardNavigationPlugin({ inputTarget: canvas })
				),
		},
		{
			id: 'keyboard-editing',
			scope: 'view',
			matches: () => !hasCoarsePointer,
			load: () =>
				import('@8f4e/editor-plugin-keyboard-editing').then(module =>
					module.createKeyboardEditingPlugin({ inputTarget: canvas })
				),
		},
		{
			id: 'keyboard-mode-switching',
			scope: 'view',
			matches: () => !hasCoarsePointer && includeKeyboardModeSwitching,
			load: () =>
				import('@8f4e/editor-plugin-keyboard-mode-switching').then(module =>
					module.createKeyboardModeSwitchingPlugin({ inputTarget: canvas })
				),
		},
		{
			id: 'font-preview',
			scope: 'view',
			matches: () => !hasCoarsePointer,
			load: () =>
				import('@8f4e/editor-plugin-font-preview').then(module =>
					module.createFontPreviewPlugin({ inputTarget: canvas })
				),
		},
		{
			id: 'example-modules',
			scope: 'view',
			matches: () => true,
			load: () =>
				Promise.all([
					import('@8f4e/editor-plugin-example-modules'),
					import('virtual:8f4e-sources/example-modules'),
				]).then(([module, sources]) => module.createExampleModulesPlugin({ sources: sources.default })),
		},
		{
			id: 'toggle-skip-execution',
			scope: 'view',
			matches: () => true,
			load: () => import('@8f4e/editor-plugin-toggle-skip-execution').then(module => module.toggleSkipExecutionPlugin),
		},
		{
			id: 'grouping',
			scope: 'view',
			matches: () => true,
			load: () =>
				import('@8f4e/editor-plugin-grouping').then(module =>
					module.createGroupingPlugin({
						writeClipboardText: text => browserWindow.navigator.clipboard.writeText(text),
					})
				),
		},
		{
			id: 'favorites',
			scope: 'view',
			matches: () => true,
			load: () => import('@8f4e/editor-plugin-favorites').then(module => module.favoritesPlugin),
		},
		{
			id: 'remove-memory-connections',
			scope: 'view',
			matches: () => true,
			load: () =>
				import('@8f4e/editor-plugin-remove-memory-connections').then(module => module.removeMemoryConnectionsPlugin),
		},
		{
			id: 'project-open',
			scope: 'view',
			matches: () => true,
			load: () =>
				import('@8f4e/editor-plugin-project-open').then(module =>
					module.createProjectOpenPlugin({
						document: canvas.ownerDocument,
						fileSession,
						showOpenMenuItem: options.showOpenMenuItem,
					})
				),
		},
		{
			id: 'wasm-export',
			scope: 'view',
			matches: () => true,
			load: () =>
				import('@8f4e/editor-plugin-wasm-export').then(module =>
					module.createWasmExportPlugin({ document: canvas.ownerDocument, getCodeBuffer: options.getCodeBuffer })
				),
		},
		{
			id: 'screenshot',
			scope: 'view',
			matches: () => true,
			load: () =>
				import('@8f4e/editor-plugin-screenshot').then(module =>
					module.createScreenshotPlugin({ canvas, renderFrame: options.renderFrame })
				),
		},
		...createLazyPluginRegistry({
			inputTarget: canvas,
			prefersReducedMotion: () => motionPreference.matches,
			navigator: browserWindow.navigator,
			writeMemory: options.writeMemory,
			getMemory: options.getMemory,
			getCodeBuffer: options.getCodeBuffer,
			getAssertionSites: options.getAssertionSites,
			sharedAudioContext: options.sharedAudioContext,
		}),
	]);
}
