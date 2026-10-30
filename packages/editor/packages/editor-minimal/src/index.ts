import initEditor, { type Editor, type EditorOptions } from '@8f4e/editor-core';
import { createProjectFileSession } from '@8f4e/editor-file-session';
import { assertionMarkersPlugin } from '@8f4e/editor-plugin-assertion-markers';
import { type CompilerDiagnostics, createCompilerPlugin } from '@8f4e/editor-plugin-compiler';
import { connectorsPlugin } from '@8f4e/editor-plugin-connectors';
import { createKeyboardMemoryPlugin } from '@8f4e/editor-plugin-keyboard-memory';
import { createLazyPluginLoaderPlugin } from '@8f4e/editor-plugin-lazy-loader';
import { createProjectSavePlugin } from '@8f4e/editor-plugin-project-save';
import { createProjectUrlLoaderPlugin } from '@8f4e/editor-plugin-project-url-loader';
import { createStackPlugin } from '@8f4e/editor-plugin-stack';
import { tooltipsPlugin } from '@8f4e/editor-plugin-tooltips';
import { createWatchPlugin } from '@8f4e/editor-plugin-watch';
import { createLazyPluginRegistry } from './lazy-plugins';
import { resolveStdlibInclude } from './stdlib-resolver';

export type MinimalEditorInstance = Editor & { getCompilerDiagnostics: () => CompilerDiagnostics | null };

export interface MinimalEditorMountOptions {
	/** Borrow this context when its sample rate matches the project. The host owns its lifetime. */
	sharedAudioContext?: AudioContext;
	/** Capture wheel gestures for viewport panning. Disable this in scrolling pages. */
	captureWheel?: boolean;
	featureFlags?: EditorOptions['featureFlags'];
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
		featureFlags,
		initialProjectUrl,
		onInitialProjectLoaded,
		onInitialProjectLoadError,
	}: MinimalEditorMountOptions = {}
): Promise<MinimalEditorInstance> {
	const compiler = createCompilerPlugin({ resolveInclude: resolveStdlibInclude });
	const fileSession = createProjectFileSession();
	const browserWindow = canvas.ownerDocument.defaultView!;
	const motionPreference = browserWindow.matchMedia('(prefers-reduced-motion: reduce)');
	const prefersReducedMotion = () => motionPreference.matches;
	const editor = await initEditor(canvas, {
		plugins: [
			compiler.plugin,
			fileSession.plugin,
			connectorsPlugin,
			createProjectUrlLoaderPlugin({
				fetch: globalThis.fetch,
				initialProjectUrl,
				onLoaded: onInitialProjectLoaded,
				onError: onInitialProjectLoadError,
			}),
			assertionMarkersPlugin,
			createProjectSavePlugin({ inputTarget: canvas, fileSession }),
			createKeyboardMemoryPlugin({ inputTarget: canvas, writeMemory: compiler.writeMemory }),
			createLazyPluginLoaderPlugin(
				createLazyPluginRegistry({
					navigator: browserWindow.navigator,
					writeMemory: compiler.writeMemory,
					getMemory: compiler.getMemory,
					getCodeBuffer: compiler.getCodeBuffer,
					getAssertionSites: compiler.getAssertionSites,
					sharedAudioContext,
				})
			),
			createWatchPlugin({ prefersReducedMotion }),
			createStackPlugin({ prefersReducedMotion }),
			tooltipsPlugin,
		],
		captureWheel,
		featureFlags: { projectCreation: false, ...featureFlags },
	});
	if (!initialProjectUrl) onInitialProjectLoaded?.();
	return Object.assign(editor, { getCompilerDiagnostics: compiler.getDiagnostics });
}
