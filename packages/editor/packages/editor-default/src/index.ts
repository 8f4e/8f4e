import exampleModuleSources from 'virtual:8f4e-sources/example-modules';
import initEditor, { type Editor, type EditorOptions } from '@8f4e/editor-core';
import { assertionMarkersPlugin } from '@8f4e/editor-plugin-assertion-markers';
import { type CompilerDiagnostics, createCompilerPlugin } from '@8f4e/editor-plugin-compiler';
import { createExampleModulesPlugin } from '@8f4e/editor-plugin-example-modules';
import { groupingPlugin } from '@8f4e/editor-plugin-grouping';
import { createKeyboardMemoryPlugin } from '@8f4e/editor-plugin-keyboard-memory';
import { createLazyPluginLoaderPlugin } from '@8f4e/editor-plugin-lazy-loader';
import { createProjectFilesPlugin } from '@8f4e/editor-plugin-project-files';
import { createProjectUrlLoaderPlugin } from '@8f4e/editor-plugin-project-url-loader';
import { removeMemoryConnectionsPlugin } from '@8f4e/editor-plugin-remove-memory-connections';
import { createScreenshotPlugin } from '@8f4e/editor-plugin-screenshot';
import { createSessionPersistencePlugin } from '@8f4e/editor-plugin-session-persistence';
import { createStackPlugin } from '@8f4e/editor-plugin-stack';
import { toggleFavoritePlugin } from '@8f4e/editor-plugin-toggle-favorite';
import { toggleSkipExecutionPlugin } from '@8f4e/editor-plugin-toggle-skip-execution';
import { tooltipsPlugin } from '@8f4e/editor-plugin-tooltips';
import { createWasmExportPlugin } from '@8f4e/editor-plugin-wasm-export';
import { createWatchPlugin } from '@8f4e/editor-plugin-watch';
import { createLazyPluginRegistry } from './lazy-plugins';
import { resolveStdlibInclude } from './stdlib-resolver';

const DEFAULT_STORAGE_NAMESPACE = 'editor';

export type DefaultEditorInstance = Editor & { getCompilerDiagnostics: () => CompilerDiagnostics | null };

export function createDefaultEditorPlugins(options: {
	canvas: HTMLCanvasElement;
	storage: Storage;
	storageKey: string;
	initialProjectUrl?: string;
	onInitialProjectLoaded?: () => void;
	onInitialProjectLoadError?: (error: unknown) => void;
	renderFrame: () => void;
	showOpenMenuItem: boolean;
	getMemory: () => WebAssembly.Memory | null;
	writeMemory: (address: number, value: number, isInteger: boolean) => void;
	getCodeBuffer: () => Uint8Array;
	getAssertionSites: ReturnType<typeof createCompilerPlugin>['getAssertionSites'];
	sharedAudioContext?: AudioContext;
}): NonNullable<EditorOptions['plugins']> {
	const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');
	const prefersReducedMotion = () => motionPreference.matches;
	return [
		createProjectUrlLoaderPlugin({
			fetch: globalThis.fetch,
			initialProjectUrl: options.initialProjectUrl,
			onLoaded: options.onInitialProjectLoaded,
			onError: options.onInitialProjectLoadError,
		}),
		createSessionPersistencePlugin({
			storage: options.storage,
			storageKey: options.storageKey,
			restoreOnStartup: !options.initialProjectUrl,
		}),
		createExampleModulesPlugin({ sources: exampleModuleSources }),
		assertionMarkersPlugin,
		createKeyboardMemoryPlugin({ inputTarget: options.canvas, writeMemory: options.writeMemory }),
		toggleSkipExecutionPlugin,
		groupingPlugin,
		toggleFavoritePlugin,
		removeMemoryConnectionsPlugin,
		createLazyPluginLoaderPlugin(
			createLazyPluginRegistry({
				navigator: options.canvas.ownerDocument.defaultView!.navigator,
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
		createProjectFilesPlugin({ inputTarget: options.canvas, showOpenMenuItem: options.showOpenMenuItem }),
		createWasmExportPlugin({ document: options.canvas.ownerDocument, getCodeBuffer: options.getCodeBuffer }),
		createScreenshotPlugin({ canvas: options.canvas, renderFrame: options.renderFrame }),
	];
}

export interface DefaultEditorMountOptions {
	/** Replaces the default feature plugins. The compiler is always installed first. */
	plugins?: EditorOptions['plugins'];
	/** Borrow this context when its sample rate matches the project. The host owns its lifetime. */
	sharedAudioContext?: AudioContext;
	/** Capture wheel gestures for viewport panning. Disable this for editors embedded in scrolling pages. */
	captureWheel?: boolean;
	featureFlags?: EditorOptions['featureFlags'];
	initialProjectUrl?: string;
	/** Initial source is installed; compilation and asset loading continue independently. */
	onInitialProjectLoaded?: () => void;
	/** The initial URL request or source parsing failed. */
	onInitialProjectLoadError?: (error: unknown) => void;
	/** Show Open From Disk in the project-files plugin menu. */
	showOpenMenuItem?: boolean;
	storage?: Storage;
	storageNamespace?: string;
}

export async function mountDefaultEditor(
	canvas: HTMLCanvasElement,
	{
		plugins,
		sharedAudioContext,
		captureWheel,
		featureFlags,
		initialProjectUrl,
		onInitialProjectLoaded,
		onInitialProjectLoadError,
		showOpenMenuItem = true,
		storage = localStorage,
		storageNamespace = DEFAULT_STORAGE_NAMESPACE,
	}: DefaultEditorMountOptions = {}
): Promise<DefaultEditorInstance> {
	const compiler = createCompilerPlugin({ resolveInclude: resolveStdlibInclude });
	let editor: Editor;
	editor = await initEditor(canvas, {
		plugins: [
			compiler.plugin,
			...(plugins ??
				createDefaultEditorPlugins({
					canvas,
					storage,
					storageKey: `project_${storageNamespace}`,
					initialProjectUrl,
					onInitialProjectLoaded,
					onInitialProjectLoadError,
					renderFrame: () => editor.renderFrame(),
					showOpenMenuItem,
					getMemory: compiler.getMemory,
					writeMemory: compiler.writeMemory,
					getCodeBuffer: compiler.getCodeBuffer,
					getAssertionSites: compiler.getAssertionSites,
					sharedAudioContext,
				})),
		],
		captureWheel,
		featureFlags,
	});
	if (!initialProjectUrl) onInitialProjectLoaded?.();

	return Object.assign(editor, { getCompilerDiagnostics: compiler.getDiagnostics });
}
