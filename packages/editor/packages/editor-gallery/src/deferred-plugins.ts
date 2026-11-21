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
	prefersReducedMotion,
	sharedAudioContext,
	includeKeyboardModeSwitching = true,
	captureWheel,
	touchNavigation,
	defaultFont,
}: {
	canvas: HTMLCanvasElement;
	compiler: ReturnType<typeof createCompilerPlugin>;
	fileSession: ProjectFileSession;
	prefersReducedMotion: () => boolean;
	sharedAudioContext?: AudioContext;
	includeKeyboardModeSwitching?: boolean;
	captureWheel?: boolean;
	touchNavigation?: GalleryEditorMountOptions['touchNavigation'];
	defaultFont?: GalleryEditorMountOptions['defaultFont'];
}): EditorPlugin {
	const browserWindow = canvas.ownerDocument.defaultView!;
	const hasCoarsePointer = browserWindow.matchMedia('(pointer: coarse)').matches;
	const hasModeHint = !hasCoarsePointer && includeKeyboardModeSwitching;
	return createLazyPluginLoaderPlugin([
		{
			id: 'block-authoring',
			scope: 'view',
			matches: () => true,
			load: () => import('@8f4e/editor-plugin-block-authoring').then(module => module.blockAuthoringPlugin),
		},
		{
			id: 'elastic-viewport',
			scope: 'view',
			matches: () => true,
			load: () =>
				import('@8f4e/editor-plugin-elastic-viewport').then(module =>
					module.createElasticViewportPlugin({ prefersReducedMotion })
				),
		},
		{
			id: 'offscreen-block-arrows',
			scope: 'view',
			matches: () => true,
			load: () =>
				import('@8f4e/editor-plugin-offscreen-block-arrows').then(module => module.offscreenBlockArrowsPlugin),
		},
		{
			id: 'coordinate-grid',
			scope: 'view',
			matches: () => true,
			load: () => import('@8f4e/editor-plugin-coordinate-grid').then(module => module.coordinateGridPlugin),
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
			id: 'loose-wires',
			scope: 'view',
			matches: () => true,
			load: () => import('@8f4e/editor-plugin-loose-wires').then(module => module.createLooseWiresPlugin()),
		},
		{
			id: 'assertion-markers',
			scope: 'view',
			matches: () => true,
			load: () => import('@8f4e/editor-plugin-assertion-markers').then(module => module.assertionMarkersPlugin),
		},
		{
			id: 'stack-connections',
			scope: 'view',
			matches: () => true,
			load: () => import('@8f4e/editor-plugin-stack-connections').then(module => module.stackConnectionsPlugin),
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
			id: 'font-preview',
			scope: 'view',
			matches: () => !hasCoarsePointer,
			load: () =>
				import('@8f4e/editor-plugin-font-preview').then(module =>
					module.createFontPreviewPlugin({ inputTarget: canvas, defaultFont })
				),
		},
		{
			id: 'keyboard-mode-switching',
			scope: 'view',
			matches: () => hasModeHint,
			load: () =>
				import('@8f4e/editor-plugin-keyboard-mode-switching').then(module =>
					module.createKeyboardModeSwitchingPlugin({ inputTarget: canvas })
				),
		},
		{
			id: 'enter-group-button',
			scope: 'view',
			matches: () => true,
			load: () => import('@8f4e/editor-plugin-enter-group-button').then(module => module.enterGroupButtonPlugin),
		},
		{
			id: 'group-path',
			scope: 'view',
			matches: () => true,
			load: () =>
				import('@8f4e/editor-plugin-group-path').then(module =>
					module.createGroupPathPlugin({ topRow: hasModeHint ? 1 : 0 })
				),
		},
		...createLazyPluginRegistry({
			inputTarget: canvas,
			prefersReducedMotion,
			navigator: browserWindow.navigator,
			writeMemory: compiler.writeMemory,
			getMemory: compiler.getMemory,
			getCodeBuffer: compiler.getCodeBuffer,
			getAssertionSites: compiler.getAssertionSites,
			sharedAudioContext,
		}),
	]);
}
