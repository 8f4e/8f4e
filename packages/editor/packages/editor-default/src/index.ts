import initEditor, { type Editor, type EditorOptions } from '@8f4e/editor-core';
import { createProjectFileSession } from '@8f4e/editor-file-session';
import { codeRenderingPlugin } from '@8f4e/editor-plugin-code-rendering';
import { type CompilerDiagnostics, createCompilerPlugin } from '@8f4e/editor-plugin-compiler';
import { createDeferredPluginLoaderPlugin } from '@8f4e/editor-plugin-lazy-loader';
import { createProjectUrlLoaderPlugin } from '@8f4e/editor-plugin-project-url-loader';
import { createSessionPersistencePlugin } from '@8f4e/editor-plugin-session-persistence';
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
	includeKeyboardModeSwitching?: boolean;
	getMemory: () => WebAssembly.Memory | null;
	writeMemory: (address: number, value: number, isInteger: boolean) => void;
	getCodeBuffer: () => Uint8Array;
	getAssertionSites: ReturnType<typeof createCompilerPlugin>['getAssertionSites'];
	sharedAudioContext?: AudioContext;
}): NonNullable<EditorOptions['plugins']> {
	const fileSession = createProjectFileSession();
	return [
		fileSession.plugin,
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
		codeRenderingPlugin,
		createDeferredPluginLoaderPlugin({
			load: () =>
				import('./deferred-plugins').then(module => module.createDeferredEditorPlugin({ ...options, fileSession })),
		}),
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
	/** Show Open From Disk in the project-open plugin menu. */
	showOpenMenuItem?: boolean;
	/** Include the keyboard mode-switching plugin and its hint. Defaults to true. */
	includeKeyboardModeSwitching?: boolean;
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
		includeKeyboardModeSwitching,
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
					includeKeyboardModeSwitching,
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
