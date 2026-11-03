import type { EditorOptions } from '@8f4e/editor-core';
import type { ProjectFileSession } from '@8f4e/editor-file-session';
import { createLazyPluginLoaderPlugin } from '@8f4e/editor-plugin-lazy-loader';
import type { createDefaultEditorPlugins } from './index';
import { createLazyPluginRegistry } from './lazy-plugins';

export function createDeferredEditorPlugins(
	options: Parameters<typeof createDefaultEditorPlugins>[0] & { fileSession: ProjectFileSession }
): NonNullable<EditorOptions['plugins']> {
	const { canvas, fileSession, includeKeyboardModeSwitching = true } = options;
	const browserWindow = canvas.ownerDocument.defaultView!;
	const motionPreference = browserWindow.matchMedia('(prefers-reduced-motion: reduce)');
	const supportsKeyboard = !browserWindow.matchMedia('(pointer: coarse)').matches;
	return [
		createLazyPluginLoaderPlugin([
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
				id: 'keyboard-navigation',
				scope: 'view',
				matches: () => supportsKeyboard,
				load: () =>
					import('@8f4e/editor-plugin-keyboard-navigation').then(module =>
						module.createKeyboardNavigationPlugin({ inputTarget: canvas })
					),
			},
			{
				id: 'keyboard-editing',
				scope: 'view',
				matches: () => supportsKeyboard,
				load: () =>
					import('@8f4e/editor-plugin-keyboard-editing').then(module =>
						module.createKeyboardEditingPlugin({ inputTarget: canvas })
					),
			},
			{
				id: 'keyboard-mode-switching',
				scope: 'view',
				matches: () => supportsKeyboard && includeKeyboardModeSwitching,
				load: () =>
					import('@8f4e/editor-plugin-keyboard-mode-switching').then(module =>
						module.createKeyboardModeSwitchingPlugin({ inputTarget: canvas })
					),
			},
			{
				id: 'keyboard-memory',
				scope: 'view',
				matches: () => true,
				load: () =>
					import('@8f4e/editor-plugin-keyboard-memory').then(module =>
						module.createKeyboardMemoryPlugin({ inputTarget: canvas, writeMemory: options.writeMemory })
					),
			},
			{
				id: 'font-preview',
				scope: 'view',
				matches: () => supportsKeyboard,
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
				load: () =>
					import('@8f4e/editor-plugin-toggle-skip-execution').then(module => module.toggleSkipExecutionPlugin),
			},
			{
				id: 'grouping',
				scope: 'view',
				matches: () => true,
				load: () => import('@8f4e/editor-plugin-grouping').then(module => module.groupingPlugin),
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
				prefersReducedMotion: () => motionPreference.matches,
				navigator: browserWindow.navigator,
				writeMemory: options.writeMemory,
				getMemory: options.getMemory,
				getCodeBuffer: options.getCodeBuffer,
				getAssertionSites: options.getAssertionSites,
				sharedAudioContext: options.sharedAudioContext,
			}),
		]),
	];
}
