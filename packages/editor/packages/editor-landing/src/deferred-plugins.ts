import type { EditorPlugin } from '@8f4e/editor-core';
import type { createCompilerPlugin } from '@8f4e/editor-plugin-compiler';
import { createLazyPluginLoaderPlugin } from '@8f4e/editor-plugin-lazy-loader';
import type { LandingEditorMountOptions } from './index';
import { createLazyPluginRegistry } from './lazy-plugins';

export function createDeferredEditorPlugin({
	canvas,
	compiler,
	captureWheel,
	touchNavigation,
}: {
	canvas: HTMLCanvasElement;
	compiler: ReturnType<typeof createCompilerPlugin>;
	captureWheel?: boolean;
	touchNavigation?: LandingEditorMountOptions['touchNavigation'];
}): EditorPlugin {
	const browserWindow = canvas.ownerDocument.defaultView!;
	const motionPreference = browserWindow.matchMedia('(prefers-reduced-motion: reduce)');
	const hasCoarsePointer = browserWindow.matchMedia('(pointer: coarse)').matches;
	return createLazyPluginLoaderPlugin([
		{
			id: 'error-messages',
			scope: 'view',
			matches: () => true,
			load: () => import('@8f4e/editor-plugin-error-messages').then(module => module.errorMessagesPlugin),
		},
		{
			id: 'connectors',
			scope: 'view',
			matches: () => true,
			load: () => import('@8f4e/editor-plugin-connectors').then(module => module.connectorsPlugin),
		},
		{
			id: 'tooltips',
			scope: 'view',
			matches: () => true,
			load: () => import('@8f4e/editor-plugin-tooltips').then(module => module.tooltipsPlugin),
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
		...createLazyPluginRegistry({
			prefersReducedMotion: () => motionPreference.matches,
			writeMemory: compiler.writeMemory,
			getMemory: compiler.getMemory,
			getCodeBuffer: compiler.getCodeBuffer,
		}),
	]);
}
