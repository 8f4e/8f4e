import initEditor, { type Editor, type EditorOptions } from '@8f4e/editor-core';
import { buttonPlugin } from '@8f4e/editor-plugin-button';
import { pianoPlugin } from '@8f4e/editor-plugin-piano';
import { sliderPlugin } from '@8f4e/editor-plugin-slider';
import { switchPlugin } from '@8f4e/editor-plugin-switch';
import { toggleSkipExecutionPlugin } from '@8f4e/editor-plugin-toggle-skip-execution';
import { tooltipsPlugin } from '@8f4e/editor-plugin-tooltips';
import { wavePlugin } from '@8f4e/editor-plugin-wave';
import { createCompilerService } from './compiler-callback';
import { getListOfModules, getModule, getModuleDependencies } from './examples/moduleRegistry';
import { getProject } from './get-project';
import { createRuntimeRegistry } from './runtime-registry';
import { resolveStdlibInclude } from './stdlib-resolver';
import {
	createProjectFileCallbacks,
	createStorageCallbacks,
	exportBinaryCode,
	exportCanvasScreenshot,
} from './storage-callbacks';

const DEFAULT_STORAGE_NAMESPACE = 'editor';

export type DefaultEditorInstance = Editor;

export const defaultEditorPlugins: NonNullable<EditorOptions['plugins']> = [
	toggleSkipExecutionPlugin,
	switchPlugin,
	buttonPlugin,
	wavePlugin,
	pianoPlugin,
	sliderPlugin,
	tooltipsPlugin,
];

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
		plugins = defaultEditorPlugins,
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
	const { dispose: disposeProjectFiles, ...projectFileCallbacks } = createProjectFileCallbacks();
	let editor: Editor;
	try {
		editor = await initEditor(canvas, {
			plugins,
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
				...projectFileCallbacks,
				exportBinaryCode: fileName => exportBinaryCode(fileName, compilerService.getCodeBuffer()),
				exportCanvasScreenshot,
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
