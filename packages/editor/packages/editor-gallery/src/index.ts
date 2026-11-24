import initEditor, { type Editor, type EditorOptions } from '@8f4e/editor-core';
import { codeBlockBackgroundPlugin } from '@8f4e/editor-plugin-code-block-background';
import { codeRenderingPlugin } from '@8f4e/editor-plugin-code-rendering';
import { type CompilerDiagnostics, createCompilerPlugin } from '@8f4e/editor-plugin-compiler';
import { dottedBackgroundPlugin } from '@8f4e/editor-plugin-dotted-background';
import { homePlugin } from '@8f4e/editor-plugin-home';
import { createDeferredPluginLoaderPlugin } from '@8f4e/editor-plugin-lazy-loader';
import { createLoadingIndicatorsPlugin } from '@8f4e/editor-plugin-loading-indicators';
import { createProjectUrlLoaderPlugin } from '@8f4e/editor-plugin-project-url-loader';
import type { TouchInputOptions } from '@8f4e/editor-plugin-touch-input';
import { Engine } from 'glugglugglug';
import { resolveStdlibInclude } from './stdlib-resolver';

export type GalleryEditorInstance = Editor & { getCompilerDiagnostics: () => CompilerDiagnostics | null };

export interface GalleryEditorMountOptions {
	/** Supply a renderer for this canvas instead of creating a WebGL engine. */
	renderer?: EditorOptions['renderer'];
	/** Borrow this context when its sample rate matches the project. The host owns its lifetime. */
	sharedAudioContext?: AudioContext;
	/** Capture wheel gestures for viewport panning. Disable this in scrolling pages. */
	captureWheel?: boolean;
	/** Configure one-finger touch panning; defaults to both directions. */
	touchNavigation?: Omit<TouchInputOptions, 'inputTarget'>;
	/** Font for projects without a font directive; Departure Mono 14 on coarse pointers, IBM VGA otherwise. */
	defaultFont?: EditorOptions['defaultFont'];
	featureFlags?: EditorOptions['featureFlags'];
	/** Include the keyboard mode-switching plugin and its hint. Defaults to true. */
	includeKeyboardModeSwitching?: boolean;
	initialProjectUrl?: string;
}

export async function mountGalleryEditor(
	canvas: HTMLCanvasElement,
	{
		renderer,
		sharedAudioContext,
		captureWheel,
		touchNavigation,
		defaultFont = canvas.ownerDocument.defaultView!.matchMedia('(pointer: coarse)').matches
			? 'departuremono7x14'
			: undefined,
		featureFlags,
		includeKeyboardModeSwitching,
		initialProjectUrl,
	}: GalleryEditorMountOptions = {}
): Promise<GalleryEditorInstance> {
	const compiler = createCompilerPlugin({ resolveInclude: resolveStdlibInclude });
	const motionPreference = canvas.ownerDocument.defaultView!.matchMedia('(prefers-reduced-motion: reduce)');
	const prefersReducedMotion = () => motionPreference.matches;
	const editor = await initEditor(canvas, {
		plugins: [
			compiler.plugin,
			homePlugin,
			dottedBackgroundPlugin,
			codeBlockBackgroundPlugin,
			codeRenderingPlugin,
			createLoadingIndicatorsPlugin({ prefersReducedMotion }),
			createProjectUrlLoaderPlugin({
				fetch: globalThis.fetch,
				initialProjectUrl,
			}),
			createDeferredPluginLoaderPlugin({
				load: () =>
					import('./deferred-plugins').then(module =>
						module.createDeferredEditorPlugin({
							canvas,
							compiler,
							prefersReducedMotion,
							sharedAudioContext,
							includeKeyboardModeSwitching,
							captureWheel,
							touchNavigation,
							defaultFont,
						})
					),
			}),
		],
		defaultFont,
		featureFlags,
		renderer: renderer ?? new Engine(canvas),
	});
	return Object.assign(editor, { getCompilerDiagnostics: compiler.getDiagnostics });
}
