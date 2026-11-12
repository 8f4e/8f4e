import type { EditorPlugin } from '@8f4e/editor-core';
import type { ProjectFileSession } from '@8f4e/editor-file-session';
import type { createCompilerPlugin } from '@8f4e/editor-plugin-compiler';
import { createLazyPluginLoaderPlugin } from '@8f4e/editor-plugin-lazy-loader';
import { INPUT_LAYERS } from '@8f4e/editor-state-types';
import type { GalleryEditorMountOptions } from './index';
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
	touchNavigation?: GalleryEditorMountOptions['touchNavigation'];
}): EditorPlugin {
	const browserWindow = canvas.ownerDocument.defaultView!;
	const motionPreference = browserWindow.matchMedia('(prefers-reduced-motion: reduce)');
	const hasCoarsePointer = browserWindow.matchMedia('(pointer: coarse)').matches;
	return createLazyPluginLoaderPlugin([
		{
			id: 'block-authoring',
			scope: 'view',
			matches: () => true,
			load: () => import('@8f4e/editor-plugin-block-authoring').then(module => module.blockAuthoringPlugin),
		},
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
			id: 'stack-producers',
			scope: 'view',
			matches: () => true,
			load: () => import('@8f4e/editor-plugin-stack-producers').then(module => module.stackProducersPlugin),
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
		...createLazyPluginRegistry({
			inputTarget: canvas,
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
