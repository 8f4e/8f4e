import exampleModuleSources from 'virtual:8f4e-sources/example-modules';
import initEditor, { type Editor, type EditorOptions } from '@8f4e/editor-core';
import { assertionMarkersPlugin } from '@8f4e/editor-plugin-assertion-markers';
import { barsPlugin } from '@8f4e/editor-plugin-bars';
import { createBinaryAssetsPlugin } from '@8f4e/editor-plugin-binary-assets';
import { buttonPlugin } from '@8f4e/editor-plugin-button';
import { crossfadePlugin } from '@8f4e/editor-plugin-crossfade';
import { createExampleModulesPlugin } from '@8f4e/editor-plugin-example-modules';
import { createKeyboardMemoryPlugin } from '@8f4e/editor-plugin-keyboard-memory';
import { meterPlugin } from '@8f4e/editor-plugin-meter';
import { createMidiInputPlugin } from '@8f4e/editor-plugin-midi-input';
import { pianoPlugin } from '@8f4e/editor-plugin-piano';
import { plotPlugin } from '@8f4e/editor-plugin-plot';
import { createProjectFilesPlugin } from '@8f4e/editor-plugin-project-files';
import { createProjectUrlLoaderPlugin } from '@8f4e/editor-plugin-project-url-loader';
import { removeMemoryConnectionsPlugin } from '@8f4e/editor-plugin-remove-memory-connections';
import { createScreenshotPlugin } from '@8f4e/editor-plugin-screenshot';
import { createSessionPersistencePlugin } from '@8f4e/editor-plugin-session-persistence';
import { sliderPlugin } from '@8f4e/editor-plugin-slider';
import { createStackPlugin } from '@8f4e/editor-plugin-stack';
import { switchPlugin } from '@8f4e/editor-plugin-switch';
import { toggleFavoritePlugin } from '@8f4e/editor-plugin-toggle-favorite';
import { toggleSkipExecutionPlugin } from '@8f4e/editor-plugin-toggle-skip-execution';
import { tooltipsPlugin } from '@8f4e/editor-plugin-tooltips';
import { createWasmExportPlugin } from '@8f4e/editor-plugin-wasm-export';
import { createWatchPlugin } from '@8f4e/editor-plugin-watch';
import { wavePlugin } from '@8f4e/editor-plugin-wave';
import { createCompilerService } from './compiler-callback';
import { createRuntimeRegistry } from './runtime-registry';
import { resolveStdlibInclude } from './stdlib-resolver';

const DEFAULT_STORAGE_NAMESPACE = 'editor';

export type DefaultEditorInstance = Editor;

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
	getCodeBuffer: () => Uint8Array;
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
		createKeyboardMemoryPlugin({ inputTarget: options.canvas }),
		createMidiInputPlugin({
			navigator: options.canvas.ownerDocument.defaultView!.navigator,
			getMemory: options.getMemory,
			getCodeBuffer: options.getCodeBuffer,
		}),
		createBinaryAssetsPlugin({
			getMemoryBytes: () => {
				const memory = options.getMemory();
				return memory ? new Uint8Array(memory.buffer) : undefined;
			},
		}),
		toggleSkipExecutionPlugin,
		toggleFavoritePlugin,
		removeMemoryConnectionsPlugin,
		switchPlugin,
		buttonPlugin,
		wavePlugin,
		pianoPlugin,
		sliderPlugin,
		meterPlugin,
		plotPlugin,
		barsPlugin,
		crossfadePlugin,
		createWatchPlugin({ prefersReducedMotion }),
		createStackPlugin({ prefersReducedMotion }),
		tooltipsPlugin,
		createProjectFilesPlugin({ inputTarget: options.canvas, showOpenMenuItem: options.showOpenMenuItem }),
		createWasmExportPlugin({ document: options.canvas.ownerDocument, getCodeBuffer: options.getCodeBuffer }),
		createScreenshotPlugin({ canvas: options.canvas, renderFrame: options.renderFrame }),
	];
}

export interface DefaultEditorMountOptions {
	/** Replaces the default plugin set. Pass an empty array to omit all plugins. */
	plugins?: EditorOptions['plugins'];
	/** Borrow this context when its sample rate matches the project. The host owns its lifetime. */
	sharedAudioContext?: AudioContext;
	/** Capture wheel gestures for viewport panning. Disable this for editors embedded in scrolling pages. */
	captureWheel?: boolean;
	featureFlags?: EditorOptions['featureFlags'];
	initialEditorMode?: EditorOptions['initialEditorMode'];
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
		initialEditorMode,
		initialProjectUrl,
		onInitialProjectLoaded,
		onInitialProjectLoadError,
		showOpenMenuItem = true,
		storage = localStorage,
		storageNamespace = DEFAULT_STORAGE_NAMESPACE,
	}: DefaultEditorMountOptions = {}
): Promise<DefaultEditorInstance> {
	const compilerService = createCompilerService();
	let editor: Editor;
	try {
		editor = await initEditor(canvas, {
			plugins:
				plugins ??
				createDefaultEditorPlugins({
					canvas,
					storage,
					storageKey: `project_${storageNamespace}`,
					initialProjectUrl,
					onInitialProjectLoaded,
					onInitialProjectLoadError,
					renderFrame: () => editor.renderFrame(),
					showOpenMenuItem,
					getMemory: compilerService.getMemory,
					getCodeBuffer: compilerService.getCodeBuffer,
				}),
			captureWheel,
			featureFlags,
			initialEditorMode,
			runtimeRegistry: createRuntimeRegistry(compilerService, sharedAudioContext),
			callbacks: {
				resolveInclude: resolveStdlibInclude,
				compileCode: (input, compilerOptions) => compilerService.compileCode(input, compilerOptions, editor),
			},
		});
	} catch (error) {
		compilerService.dispose();
		throw error;
	}
	if (!initialProjectUrl) onInitialProjectLoaded?.();

	return {
		...editor,
		dispose: () => {
			try {
				editor.dispose();
			} finally {
				compilerService.dispose();
			}
		},
	};
}
