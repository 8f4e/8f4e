import initEditor, { type Editor, type EditorOptions } from '@8f4e/editor-core';
import { assertionMarkersPlugin } from '@8f4e/editor-plugin-assertion-markers';
import { createBinaryAssetsPlugin } from '@8f4e/editor-plugin-binary-assets';
import { type CompilerDiagnostics, createCompilerPlugin } from '@8f4e/editor-plugin-compiler';
import { createKeyboardMemoryPlugin } from '@8f4e/editor-plugin-keyboard-memory';
import { createLazyPluginLoaderPlugin } from '@8f4e/editor-plugin-lazy-loader';
import { createMidiInputPlugin } from '@8f4e/editor-plugin-midi-input';
import { createProjectUrlLoaderPlugin } from '@8f4e/editor-plugin-project-url-loader';
import { createStackPlugin } from '@8f4e/editor-plugin-stack';
import { tooltipsPlugin } from '@8f4e/editor-plugin-tooltips';
import { createWatchPlugin } from '@8f4e/editor-plugin-watch';
import { createLazyPluginRegistry } from './lazy-plugins';
import { resolveStdlibInclude } from './stdlib-resolver';

export type MinimalEditorInstance = Editor & { getCompilerDiagnostics: () => CompilerDiagnostics | null };

function createMinimalEditorPlugins(options: {
	canvas: HTMLCanvasElement;
	initialProjectUrl?: string;
	onInitialProjectLoaded?: () => void;
	onInitialProjectLoadError?: (error: unknown) => void;
	getMemory: () => WebAssembly.Memory | null;
	writeMemory: (address: number, value: number, isInteger: boolean) => void;
	getCodeBuffer: () => Uint8Array;
	getAssertionSites: ReturnType<typeof createCompilerPlugin>['getAssertionSites'];
	sharedAudioContext?: AudioContext;
}): NonNullable<EditorOptions['plugins']> {
	const browserWindow = options.canvas.ownerDocument.defaultView!;
	const motionPreference = browserWindow.matchMedia('(prefers-reduced-motion: reduce)');
	const prefersReducedMotion = () => motionPreference.matches;
	return [
		createProjectUrlLoaderPlugin({
			fetch: globalThis.fetch,
			initialProjectUrl: options.initialProjectUrl,
			onLoaded: options.onInitialProjectLoaded,
			onError: options.onInitialProjectLoadError,
		}),
		assertionMarkersPlugin,
		createKeyboardMemoryPlugin({ inputTarget: options.canvas, writeMemory: options.writeMemory }),
		createMidiInputPlugin({
			navigator: browserWindow.navigator,
			getMemory: options.getMemory,
			getCodeBuffer: options.getCodeBuffer,
		}),
		createBinaryAssetsPlugin({
			getMemoryBytes: () => {
				const memory = options.getMemory();
				return memory ? new Uint8Array(memory.buffer) : undefined;
			},
		}),
		createLazyPluginLoaderPlugin(
			createLazyPluginRegistry({
				writeMemory: options.writeMemory,
				getMemory: options.getMemory,
				getCodeBuffer: options.getCodeBuffer,
				getAssertionSites: options.getAssertionSites,
				sharedAudioContext: options.sharedAudioContext,
			})
		),
		createWatchPlugin({ prefersReducedMotion }),
		createStackPlugin({ prefersReducedMotion }),
		tooltipsPlugin,
	];
}

export interface MinimalEditorMountOptions {
	/** Borrow this context when its sample rate matches the project. The host owns its lifetime. */
	sharedAudioContext?: AudioContext;
	/** Capture wheel gestures for viewport panning. Disable this in scrolling pages. */
	captureWheel?: boolean;
	featureFlags?: EditorOptions['featureFlags'];
	initialEditorMode?: EditorOptions['initialEditorMode'];
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
		initialEditorMode = 'edit',
		initialProjectUrl,
		onInitialProjectLoaded,
		onInitialProjectLoadError,
	}: MinimalEditorMountOptions = {}
): Promise<MinimalEditorInstance> {
	const compiler = createCompilerPlugin({ resolveInclude: resolveStdlibInclude });
	const editor = await initEditor(canvas, {
		plugins: [
			compiler.plugin,
			...createMinimalEditorPlugins({
				canvas,
				initialProjectUrl,
				onInitialProjectLoaded,
				onInitialProjectLoadError,
				getMemory: compiler.getMemory,
				writeMemory: compiler.writeMemory,
				getCodeBuffer: compiler.getCodeBuffer,
				getAssertionSites: compiler.getAssertionSites,
				sharedAudioContext,
			}),
		],
		captureWheel,
		featureFlags: { projectCreation: false, ...featureFlags },
		initialEditorMode,
	});
	if (!initialProjectUrl) onInitialProjectLoaded?.();
	return Object.assign(editor, { getCompilerDiagnostics: compiler.getDiagnostics });
}
