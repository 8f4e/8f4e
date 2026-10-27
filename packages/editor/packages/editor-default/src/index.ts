import initEditor, { type Editor, type EditorOptions } from '@8f4e/editor-core';
import { barsPlugin } from '@8f4e/editor-plugin-bars';
import { buttonPlugin } from '@8f4e/editor-plugin-button';
import { crossfadePlugin } from '@8f4e/editor-plugin-crossfade';
import { meterPlugin } from '@8f4e/editor-plugin-meter';
import { pianoPlugin } from '@8f4e/editor-plugin-piano';
import { plotPlugin } from '@8f4e/editor-plugin-plot';
import { createProjectExportPlugin } from '@8f4e/editor-plugin-project-export';
import { removeMemoryConnectionsPlugin } from '@8f4e/editor-plugin-remove-memory-connections';
import { createScreenshotPlugin } from '@8f4e/editor-plugin-screenshot';
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
import { getListOfModules, getModule, getModuleDependencies } from './examples/moduleRegistry';
import { getProject } from './get-project';
import { createRuntimeRegistry } from './runtime-registry';
import { resolveStdlibInclude } from './stdlib-resolver';
import { createProjectFileCallbacks, createStorageCallbacks, exportBinaryCode } from './storage-callbacks';

const DEFAULT_STORAGE_NAMESPACE = 'editor';

export type DefaultEditorInstance = Editor;

export function createDefaultEditorPlugins(options: {
	canvas: HTMLCanvasElement;
	renderFrame: () => void;
	saveProject: (text: string, fileName: string) => Promise<void>;
	exportProject: (text: string, fileName: string) => Promise<void>;
	exportBinaryCode: (fileName: string) => Promise<void>;
}): NonNullable<EditorOptions['plugins']> {
	const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');
	const prefersReducedMotion = () => motionPreference.matches;
	return [
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
		createProjectExportPlugin({
			inputTarget: options.canvas,
			saveProject: options.saveProject,
			exportProject: options.exportProject,
		}),
		createWasmExportPlugin({ exportBinaryCode: options.exportBinaryCode }),
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
		storage = localStorage,
		storageNamespace = DEFAULT_STORAGE_NAMESPACE,
	}: DefaultEditorMountOptions = {}
): Promise<DefaultEditorInstance> {
	const compilerService = createCompilerService();
	const storageCallbacks = createStorageCallbacks({ storage, storageNamespace, initialProjectUrl });
	const {
		dispose: disposeProjectFiles,
		saveProject,
		exportProject,
		...projectImportCallbacks
	} = createProjectFileCallbacks();
	const saveWasm = (fileName: string) => exportBinaryCode(fileName, compilerService.getCodeBuffer());
	let editor: Editor;
	try {
		editor = await initEditor(canvas, {
			plugins:
				plugins ??
				createDefaultEditorPlugins({
					canvas,
					renderFrame: () => editor.renderFrame(),
					saveProject,
					exportProject,
					exportBinaryCode: saveWasm,
				}),
			captureWheel,
			featureFlags,
			initialEditorMode,
			runtimeRegistry: createRuntimeRegistry(compilerService, sharedAudioContext),
			callbacks: {
				getListOfModules,
				getModule,
				getModuleDependencies,
				getProject,
				resolveInclude: resolveStdlibInclude,
				compileCode: (input, compilerOptions) => compilerService.compileCode(input, compilerOptions, editor),
				...storageCallbacks,
				...projectImportCallbacks,
			},
		});
	} catch (error) {
		disposeProjectFiles();
		compilerService.dispose();
		throw error;
	}

	return {
		...editor,
		dispose: () => {
			disposeProjectFiles();
			try {
				editor.dispose();
			} finally {
				compilerService.dispose();
			}
		},
	};
}
