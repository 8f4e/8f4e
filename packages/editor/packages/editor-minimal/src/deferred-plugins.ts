import type { EditorPlugin } from '@8f4e/editor-core';
import type { ProjectFileSession } from '@8f4e/editor-file-session';
import type { createCompilerPlugin } from '@8f4e/editor-plugin-compiler';
import { createLazyPluginLoaderPlugin } from '@8f4e/editor-plugin-lazy-loader';
import type { MinimalEditorMountOptions } from './index';
import { createLazyPluginRegistry } from './lazy-plugins';

export function createDeferredEditorPlugin({
	canvas,
	compiler,
	fileSession,
	sharedAudioContext,
	includeKeyboardModeSwitching = true,
	captureWheel,
	touchNavigation,
}: {
	canvas: HTMLCanvasElement;
	compiler: ReturnType<typeof createCompilerPlugin>;
	fileSession: ProjectFileSession;
	sharedAudioContext?: AudioContext;
	includeKeyboardModeSwitching?: boolean;
	captureWheel?: boolean;
	touchNavigation?: MinimalEditorMountOptions['touchNavigation'];
}): EditorPlugin {
	const browserWindow = canvas.ownerDocument.defaultView!;
	const motionPreference = browserWindow.matchMedia('(prefers-reduced-motion: reduce)');
	const hasCoarsePointer = browserWindow.matchMedia('(pointer: coarse)').matches;
	return createLazyPluginLoaderPlugin([
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
					module.createMouseInputPlugin({ inputTarget: canvas, captureWheel })
				),
		},
		{
			id: 'touch-input',
			scope: 'view',
			matches: () => hasCoarsePointer,
			load: () =>
				import('@8f4e/editor-plugin-touch-input').then(module =>
					module.createTouchInputPlugin({ ...touchNavigation, inputTarget: canvas })
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
			id: 'keyboard-memory',
			scope: 'view',
			matches: () => true,
			load: () =>
				import('@8f4e/editor-plugin-keyboard-memory').then(module =>
					module.createKeyboardMemoryPlugin({ inputTarget: canvas, writeMemory: compiler.writeMemory })
				),
		},
		...createLazyPluginRegistry({
			prefersReducedMotion: () => motionPreference.matches,
			navigator: browserWindow.navigator,
			writeMemory: compiler.writeMemory,
			getMemory: compiler.getMemory,
			getCodeBuffer: compiler.getCodeBuffer,
			getAssertionSites: compiler.getAssertionSites,
			sharedAudioContext,
		}),
	]);
}
