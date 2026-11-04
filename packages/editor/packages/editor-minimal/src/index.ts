import initEditor, { type Editor, type EditorOptions } from '@8f4e/editor-core';
import { createProjectFileSession } from '@8f4e/editor-file-session';
import { codeBlockBackgroundPlugin } from '@8f4e/editor-plugin-code-block-background';
import { codeRenderingPlugin } from '@8f4e/editor-plugin-code-rendering';
import { type CompilerDiagnostics, createCompilerPlugin } from '@8f4e/editor-plugin-compiler';
import { createDeferredPluginLoaderPlugin } from '@8f4e/editor-plugin-lazy-loader';
import { createProjectUrlLoaderPlugin } from '@8f4e/editor-plugin-project-url-loader';
import type { TouchInputOptions } from '@8f4e/editor-plugin-touch-input';
import { resolveStdlibInclude } from './stdlib-resolver';

export type MinimalEditorInstance = Editor & { getCompilerDiagnostics: () => CompilerDiagnostics | null };

export interface MinimalEditorMountOptions {
	/** Borrow this context when its sample rate matches the project. The host owns its lifetime. */
	sharedAudioContext?: AudioContext;
	/** Capture wheel gestures for viewport panning. Disable this in scrolling pages. */
	captureWheel?: boolean;
	/** Configure one-finger touch panning; defaults to both directions. */
	touchNavigation?: Omit<TouchInputOptions, 'inputTarget'>;
	featureFlags?: EditorOptions['featureFlags'];
	/** Include the keyboard mode-switching plugin and its hint. Defaults to true. */
	includeKeyboardModeSwitching?: boolean;
	initialProjectUrl?: string;
	/** Initial source is installed; compilation and plugin loading continue independently. */
	onInitialProjectLoaded?: () => void;
	onInitialProjectLoadError?: (error: unknown) => void;
}

export async function mountMinimalEditor(
	canvas: HTMLCanvasElement,
	{
		sharedAudioContext,
		captureWheel,
		touchNavigation,
		featureFlags,
		includeKeyboardModeSwitching,
		initialProjectUrl,
		onInitialProjectLoaded,
		onInitialProjectLoadError,
	}: MinimalEditorMountOptions = {}
): Promise<MinimalEditorInstance> {
	const compiler = createCompilerPlugin({ resolveInclude: resolveStdlibInclude });
	const fileSession = createProjectFileSession();
	const editor = await initEditor(canvas, {
		plugins: [
			compiler.plugin,
			fileSession.plugin,
			codeBlockBackgroundPlugin,
			codeRenderingPlugin,
			createProjectUrlLoaderPlugin({
				fetch: globalThis.fetch,
				initialProjectUrl,
				onLoaded: onInitialProjectLoaded,
				onError: onInitialProjectLoadError,
			}),
			createDeferredPluginLoaderPlugin({
				load: () =>
					import('./deferred-plugins').then(module =>
						module.createDeferredEditorPlugin({
							canvas,
							compiler,
							fileSession,
							sharedAudioContext,
							includeKeyboardModeSwitching,
							captureWheel,
							touchNavigation,
						})
					),
			}),
		],
		featureFlags: { projectCreation: false, ...featureFlags },
	});
	if (!initialProjectUrl) onInitialProjectLoaded?.();
	return Object.assign(editor, { getCompilerDiagnostics: compiler.getDiagnostics });
}
