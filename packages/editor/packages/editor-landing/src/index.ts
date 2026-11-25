import initEditor, { type Editor, type EditorOptions } from '@8f4e/editor-core';
import { codeBlockBackgroundPlugin } from '@8f4e/editor-plugin-code-block-background';
import { codeRenderingPlugin } from '@8f4e/editor-plugin-code-rendering';
import { type CompilerDiagnostics, createCompilerPlugin } from '@8f4e/editor-plugin-compiler';
import { dottedBackgroundPlugin } from '@8f4e/editor-plugin-dotted-background';
import { homePlugin } from '@8f4e/editor-plugin-home';
import { createDeferredPluginLoaderPlugin } from '@8f4e/editor-plugin-lazy-loader';
import { createProjectUrlLoaderPlugin } from '@8f4e/editor-plugin-project-url-loader';
import type { TouchInputOptions } from '@8f4e/editor-plugin-touch-input';
import { createUndoRedoPlugin, type EditorHistoryHandle } from '@8f4e/editor-plugin-undo-redo';
import { Engine } from 'glugglugglug';

export type LandingEditorInstance = Editor & {
	getCompilerDiagnostics: () => CompilerDiagnostics | null;
	history: EditorHistoryHandle;
};

export interface LandingEditorMountOptions {
	/** Capture wheel gestures for viewport panning. Disable this in scrolling pages. */
	captureWheel?: boolean;
	/** Configure one-finger touch panning; defaults to both directions. */
	touchNavigation?: Omit<TouchInputOptions, 'inputTarget'>;
	/** Font for projects without a font directive; PixelCode on coarse pointers, IBM VGA otherwise. */
	defaultFont?: EditorOptions['defaultFont'];
	featureFlags?: EditorOptions['featureFlags'];
	initialProjectUrl?: string;
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
	}: LandingEditorMountOptions = {}
): Promise<LandingEditorInstance> {
	const compiler = createCompilerPlugin();
	const undoRedo = createUndoRedoPlugin();
	const editor = await initEditor(canvas, {
		plugins: [
			compiler.plugin,
			undoRedo.plugin,
			homePlugin,
			dottedBackgroundPlugin,
			codeBlockBackgroundPlugin,
			codeRenderingPlugin,
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
							captureWheel,
							touchNavigation,
						})
					),
			}),
		],
		defaultFont,
		featureFlags: { ...featureFlags, contextMenu: false },
		renderer: new Engine(canvas),
	});
	return Object.assign(editor, {
		getCompilerDiagnostics: compiler.getDiagnostics,
		history: undoRedo.createHandle(editor.editing),
	});
}
