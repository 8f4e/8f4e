import initEditor, { type Editor, type EditorOptions } from '@8f4e/editor-core';
import { codeBlockBackgroundPlugin } from '@8f4e/editor-plugin-code-block-background';
import { codeRenderingPlugin } from '@8f4e/editor-plugin-code-rendering';
import { type CompilerDiagnostics, createCompilerPlugin } from '@8f4e/editor-plugin-compiler';
import { dottedBackgroundPlugin } from '@8f4e/editor-plugin-dotted-background';
import { homePlugin } from '@8f4e/editor-plugin-home';
import { createDeferredPluginLoaderPlugin } from '@8f4e/editor-plugin-lazy-loader';
import { createLoadingIndicatorsPlugin } from '@8f4e/editor-plugin-loading-indicators';
import { createProjectUrlLoaderPlugin } from '@8f4e/editor-plugin-project-url-loader';
import { createSessionPersistencePlugin } from '@8f4e/editor-plugin-session-persistence';
import type { TouchInputOptions } from '@8f4e/editor-plugin-touch-input';
import { Engine } from 'glugglugglug';
import { resolveStdlibInclude } from './stdlib-resolver';

const DEFAULT_STORAGE_NAMESPACE = 'editor';

export type DefaultEditorInstance = Editor & { getCompilerDiagnostics: () => CompilerDiagnostics | null };

export function createDefaultEditorPlugins(options: {
	canvas: HTMLCanvasElement;
	defaultFont?: EditorOptions['defaultFont'];
	storage: Storage;
	storageKey: string;
	initialProjectUrl?: string;
	renderFrame: () => void;
	showOpenMenuItem: boolean;
	captureWheel?: boolean;
	touchNavigation?: Omit<TouchInputOptions, 'inputTarget'>;
	pwaUpdates?: Pick<ServiceWorkerContainer, 'ready'>;
	includeKeyboardModeSwitching?: boolean;
	getMemory: () => WebAssembly.Memory | null;
	writeMemory: (address: number, value: number, isInteger: boolean) => void;
	getCodeBuffer: () => Uint8Array;
	getAssertionSites: ReturnType<typeof createCompilerPlugin>['getAssertionSites'];
	sharedAudioContext?: AudioContext;
}): NonNullable<EditorOptions['plugins']> {
	const motionPreference = options.canvas.ownerDocument.defaultView!.matchMedia('(prefers-reduced-motion: reduce)');
	const prefersReducedMotion = () => motionPreference.matches;
	return [
		homePlugin,
		createProjectUrlLoaderPlugin({
			fetch: globalThis.fetch,
			initialProjectUrl: options.initialProjectUrl,
			failureMode: 'empty-project',
		}),
		createSessionPersistencePlugin({
			storage: options.storage,
			storageKey: options.storageKey,
			restoreOnStartup: !options.initialProjectUrl,
		}),
		dottedBackgroundPlugin,
		codeBlockBackgroundPlugin,
		codeRenderingPlugin,
		createLoadingIndicatorsPlugin({ prefersReducedMotion }),
		createDeferredPluginLoaderPlugin({
			load: () =>
				import('./deferred-plugins').then(module =>
					module.createDeferredEditorPlugin({ ...options, prefersReducedMotion })
				),
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
	/** Configure one-finger touch panning; defaults to both directions. */
	touchNavigation?: Omit<TouchInputOptions, 'inputTarget'>;
	/** Observe updates to a page-owned service worker through the editor's update-dialog plugin. */
	pwaUpdates?: Pick<ServiceWorkerContainer, 'ready'>;
	/** Font for projects without a font directive; PixelCode on coarse pointers, IBM VGA otherwise. */
	defaultFont?: EditorOptions['defaultFont'];
	featureFlags?: EditorOptions['featureFlags'];
	initialProjectUrl?: string;
	/** Show Open From Disk in the project-files plugin menu. */
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
		touchNavigation,
		pwaUpdates,
		defaultFont = canvas.ownerDocument.defaultView!.matchMedia('(pointer: coarse)').matches
			? 'pixelcode6x12'
			: undefined,
		featureFlags,
		initialProjectUrl,
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
					defaultFont,
					storage,
					storageKey: `project_${storageNamespace}`,
					initialProjectUrl,
					renderFrame: () => editor.renderFrame(),
					showOpenMenuItem,
					captureWheel,
					touchNavigation,
					pwaUpdates,
					includeKeyboardModeSwitching,
					getMemory: compiler.getMemory,
					writeMemory: compiler.writeMemory,
					getCodeBuffer: compiler.getCodeBuffer,
					getAssertionSites: compiler.getAssertionSites,
					sharedAudioContext,
				})),
		],
		defaultFont,
		featureFlags,
		renderer: new Engine(canvas),
	});

	return Object.assign(editor, { getCompilerDiagnostics: compiler.getDiagnostics });
}
