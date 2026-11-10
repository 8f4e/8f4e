import initEditor, { type Editor, type EditorOptions } from '@8f4e/editor-core';
import { createProjectFileSession } from '@8f4e/editor-file-session';
import { codeBlockBackgroundPlugin } from '@8f4e/editor-plugin-code-block-background';
import { codeRenderingPlugin } from '@8f4e/editor-plugin-code-rendering';
import { type CompilerDiagnostics, createCompilerPlugin } from '@8f4e/editor-plugin-compiler';
import { createDeferredPluginLoaderPlugin } from '@8f4e/editor-plugin-lazy-loader';
import { loadingIndicatorsPlugin } from '@8f4e/editor-plugin-loading-indicators';
import { createProjectUrlLoaderPlugin } from '@8f4e/editor-plugin-project-url-loader';
import type { TouchInputOptions } from '@8f4e/editor-plugin-touch-input';
import { resolveStdlibInclude } from './stdlib-resolver';

export type GalleryEditorInstance = Editor & { getCompilerDiagnostics: () => CompilerDiagnostics | null };

export interface GalleryEditorMountOptions {
	/** Borrow this context when its sample rate matches the project. The host owns its lifetime. */
	sharedAudioContext?: AudioContext;
	/** Capture wheel gestures for viewport panning. Disable this in scrolling pages. */
	captureWheel?: boolean;
	/** Configure one-finger touch panning; defaults to both directions. */
	touchNavigation?: Omit<TouchInputOptions, 'inputTarget'>;
	/** Font for projects without a font directive; PixelCode on coarse pointers, IBM VGA otherwise. */
	defaultFont?: EditorOptions['defaultFont'];
	featureFlags?: EditorOptions['featureFlags'];
	/** Include the keyboard mode-switching plugin and its hint. Defaults to true. */
	includeKeyboardModeSwitching?: boolean;
	initialProjectUrl?: string;
	/** Initial source is installed; compilation and plugin loading continue independently. */
	onInitialProjectLoaded?: () => void;
	onInitialProjectLoadError?: (error: unknown) => void;
}

export async function mountGalleryEditor(
	canvas: HTMLCanvasElement,
	{
		sharedAudioContext,
		captureWheel,
		touchNavigation,
		defaultFont = canvas.ownerDocument.defaultView!.matchMedia('(pointer: coarse)').matches
			? 'pixelcode6x12'
			: undefined,
		featureFlags,
		includeKeyboardModeSwitching,
		initialProjectUrl,
		onInitialProjectLoaded,
		onInitialProjectLoadError,
	}: GalleryEditorMountOptions = {}
): Promise<GalleryEditorInstance> {
	const compiler = createCompilerPlugin({ resolveInclude: resolveStdlibInclude });
	const fileSession = createProjectFileSession();
	const editor = await initEditor(canvas, {
		plugins: [
			compiler.plugin,
			fileSession.plugin,
			codeBlockBackgroundPlugin,
			codeRenderingPlugin,
			loadingIndicatorsPlugin,
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
		defaultFont,
		featureFlags: { projectCreation: false, ...featureFlags },
	});
	if (!initialProjectUrl) onInitialProjectLoaded?.();
	return Object.assign(editor, { getCompilerDiagnostics: compiler.getDiagnostics });
}
