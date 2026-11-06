import initEditor, { type Editor, type EditorOptions } from '@8f4e/editor-core';
import { codeBlockBackgroundPlugin } from '@8f4e/editor-plugin-code-block-background';
import { codeRenderingPlugin } from '@8f4e/editor-plugin-code-rendering';
import { type CompilerDiagnostics, createCompilerPlugin } from '@8f4e/editor-plugin-compiler';
import { createDeferredPluginLoaderPlugin } from '@8f4e/editor-plugin-lazy-loader';
import { createProjectUrlLoaderPlugin } from '@8f4e/editor-plugin-project-url-loader';
import type { TouchInputOptions } from '@8f4e/editor-plugin-touch-input';

export type LandingEditorInstance = Editor & { getCompilerDiagnostics: () => CompilerDiagnostics | null };

export interface LandingEditorMountOptions {
	/** Capture wheel gestures for viewport panning. Disable this in scrolling pages. */
	captureWheel?: boolean;
	/** Configure one-finger touch panning; defaults to both directions. */
	touchNavigation?: Omit<TouchInputOptions, 'inputTarget'>;
	/** Font for projects without a font directive; PixelCode on coarse pointers, IBM VGA otherwise. */
	defaultFont?: EditorOptions['defaultFont'];
	featureFlags?: EditorOptions['featureFlags'];
	initialProjectUrl?: string;
	/** Initial source is installed; compilation and plugin loading continue independently. */
	onInitialProjectLoaded?: () => void;
	onInitialProjectLoadError?: (error: unknown) => void;
}

export async function mountLandingEditor(
	canvas: HTMLCanvasElement,
	{
		captureWheel,
		touchNavigation,
		defaultFont = canvas.ownerDocument.defaultView!.matchMedia('(pointer: coarse)').matches
			? 'pixelcode6x12'
			: undefined,
		featureFlags,
		initialProjectUrl,
		onInitialProjectLoaded,
		onInitialProjectLoadError,
	}: LandingEditorMountOptions = {}
): Promise<LandingEditorInstance> {
	const compiler = createCompilerPlugin();
	const editor = await initEditor(canvas, {
		plugins: [
			compiler.plugin,
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
							captureWheel,
							touchNavigation,
						})
					),
			}),
		],
		defaultFont,
		featureFlags: { projectCreation: false, ...featureFlags, contextMenu: false },
	});
	if (!initialProjectUrl) onInitialProjectLoaded?.();
	return Object.assign(editor, { getCompilerDiagnostics: compiler.getDiagnostics });
}
