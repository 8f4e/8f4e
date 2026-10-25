import initState from '@8f4e/editor-state';
import type {
	Callbacks,
	EditorConfigSchemaContributionRegistry,
	EditorMode,
	EditorStatePlugin,
	InfoRecord,
	RuntimeRegistry,
	State,
} from '@8f4e/editor-state-types';
import generateSprite from '@8f4e/sprite-generator';
import initView, { type MemoryViews, type RenderStats, type WebUiOptions } from '@8f4e/web-ui';
import { createWebUiRenderProjection } from '@8f4e/web-ui-render-projection';
import {
	BIN_EDITOR_CONFIG_SCHEMA_CONTRIBUTION_ID,
	binaryAssetsEditorConfigSchemaContribution,
} from './editorEnvironmentPlugins/binaryAssets/config';
import {
	KEYBOARD_EDITOR_CONFIG_SCHEMA_CONTRIBUTION_ID,
	keyboardEditorConfigSchemaContribution,
} from './editorEnvironmentPlugins/keyboardMemory/config';
import { createEditorEnvironmentPluginManager } from './editorEnvironmentPlugins/manager';
import {
	MIDI_EDITOR_CONFIG_SCHEMA_CONTRIBUTION_ID,
	midiEditorConfigSchemaContribution,
} from './editorEnvironmentPlugins/midi/config';
import { createEditorEnvironmentPluginServices } from './editorEnvironmentPlugins/services';
import initEvents from './events';
import keyboardEvents from './events/keyboardEvents';
import pointerEvents from './events/pointerEvents';
import { createMemoryViewManager, type MemoryRef } from './memoryViewManager';
import { createSpriteSheetManager } from './spriteSheetManager';
import { updateStateWithSpriteData } from './updateStateWithSpriteData';
import {
	resolveWebUiOverlayConfig,
	WEB_UI_EDITOR_CONFIG_SCHEMA_CONTRIBUTION_ID,
	webUiEditorConfigSchemaContribution,
} from './webUiConfig';

export {
	collectSchemaConfigPaths,
	createSchemaEditorConfigValidator,
	getSchemaForConfigPath,
	parseSchemaConfigValue,
	resolveSchemaConfigRoot,
	validateSchemaConfigValue,
} from '@8f4e/editor-state';
// Re-export types that consumers might need
export type {
	CodeBlockGraphicData,
	CodeError,
	CompilationResult,
	EditorConfig,
	EditorConfigSchemaContribution,
	EditorConfigSchemaContributionRegistry,
	EditorMenuId,
	EditorMenuItemContext,
	EditorMenuItemProvider,
	EditorMenuRegistry,
	EditorMode,
	EditorStatePlugin,
	EditorStatePluginContext,
	FeatureFlags,
	FeatureFlagsConfig,
	JSONSchemaLike,
	Options,
	ParsedDirectiveRecord,
	RuntimeFactory,
	RuntimeRegistry,
	RuntimeRegistryEntry,
	RuntimeValuesByRuntimeId,
	State,
} from '@8f4e/editor-state-types';
export type { EventDispatcher } from './events';
export type { MemoryRef } from './memoryViewManager';
// Re-export helper functions
export { updateStateWithSpriteData } from './updateStateWithSpriteData';

export interface Editor {
	resize: (width: number, height: number) => void;
	pauseRendering: () => void;
	/** Releases reloadable GPU resources and the canvas drawing buffer. */
	releaseRenderingResources: () => void;
	resumeRendering: () => void;
	updateMemoryViews: (memoryRef: MemoryRef) => void;
	getMemoryViews: () => MemoryViews;
	dispose: () => void;
	state: State;
}

export interface EditorOptions {
	/** Trusted state plugins, installed before initialization and session loading. */
	plugins?: readonly EditorStatePlugin[];
	/** Capture wheel gestures for viewport panning. Disable this for editors embedded in scrolling pages. */
	captureWheel?: boolean;
	featureFlags?: Partial<State['featureFlags']>;
	/** Mode used when the editor is initialized. */
	initialEditorMode?: EditorMode;
	callbacks: Omit<
		Callbacks,
		'getWordFromMemory' | 'setWordInMemory' | 'readClipboardText' | 'writeClipboardText' | 'exportCanvasScreenshot'
	> & {
		exportCanvasScreenshot?: (blob: Blob, fileName: string) => Promise<void>;
	};
	runtimeRegistry: RuntimeRegistry;
	editorConfigSchemaContributions?: EditorConfigSchemaContributionRegistry;
	renderStatsIntervalFrames?: number;
	overlayTexture?: WebUiOptions['overlayTexture'];
}

interface CanvasSize {
	width: number;
	height: number;
}

function getCanvasDisplaySize(canvas: HTMLCanvasElement): CanvasSize | null {
	const width = Math.floor(canvas.clientWidth);
	const height = Math.floor(canvas.clientHeight);

	if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
		return null;
	}

	return { width, height };
}

async function getCanvasPngBlob(canvas: HTMLCanvasElement): Promise<Blob> {
	return new Promise<Blob>((resolve, reject) => {
		canvas.toBlob(result => {
			if (!result) {
				reject(new Error('Failed to encode canvas as PNG'));
				return;
			}

			resolve(result);
		}, 'image/png');
	});
}

function toGraphicsInfoRecord(stats: RenderStats): InfoRecord {
	return {
		timeToRenderMs: stats.timeToRenderMs,
		fps: stats.fps,
		frameBudgetMs: stats.frameBudgetMs,
		headroomMs: stats.headroomMs,
		fpsCapacity: stats.fpsCapacity,
		spriteCount: stats.spriteCount,
		uploadedInstanceBytes: stats.uploadedInstanceBytes,
	};
}

export default async function init(canvas: HTMLCanvasElement, options: EditorOptions): Promise<Editor> {
	const cleanups: Array<() => void> = [];
	const dispose = () => {
		while (cleanups.length) {
			cleanups.pop()!();
		}
	};
	try {
		const initialTabIndex = canvas.tabIndex;
		const addedTabIndex = initialTabIndex < 0 && !canvas.hasAttribute('tabindex');
		if (addedTabIndex) {
			canvas.tabIndex = 0;
			cleanups.push(() => {
				if (canvas.tabIndex === 0) canvas.removeAttribute('tabindex');
			});
		}

		const { memoryViews, updateMemoryViews } = createMemoryViewManager(new ArrayBuffer(0));
		const events = initEvents();
		cleanups.push(() => events.dispose());
		let currentMemoryRef: WebAssembly.Memory | null = null;
		let currentCodeBuffer = new Uint8Array();
		let store: ReturnType<typeof initState>;
		let view: Awaited<ReturnType<typeof initView>>;
		const exportCanvasScreenshot = options.callbacks.exportCanvasScreenshot;
		const compileCode = options.callbacks.compileCode;
		const editorConfigSchemaContributions: EditorConfigSchemaContributionRegistry = {
			[WEB_UI_EDITOR_CONFIG_SCHEMA_CONTRIBUTION_ID]: webUiEditorConfigSchemaContribution,
			[BIN_EDITOR_CONFIG_SCHEMA_CONTRIBUTION_ID]: binaryAssetsEditorConfigSchemaContribution,
			[KEYBOARD_EDITOR_CONFIG_SCHEMA_CONTRIBUTION_ID]: keyboardEditorConfigSchemaContribution,
			[MIDI_EDITOR_CONFIG_SCHEMA_CONTRIBUTION_ID]: midiEditorConfigSchemaContribution,
			...options.editorConfigSchemaContributions,
		};
		const pluginServices = createEditorEnvironmentPluginServices({
			getWasmMemory: () => currentMemoryRef,
			getCodeBuffer: () => currentCodeBuffer,
		});

		store = initState(events, {
			...options,
			editorConfigSchemaContributions,
			callbacks: {
				...options.callbacks,
				compileCode: compileCode
					? async (input, compilerOptions) => {
							const result = await compileCode(input, compilerOptions);
							currentCodeBuffer = new Uint8Array(result.codeBuffer);
							pluginServices.invalidateWasmExports();
							return result;
						}
					: undefined,
				getWordFromMemory: (allocationUnitAddress: number) => {
					return memoryViews.int32[allocationUnitAddress] || 0;
				},
				setWordInMemory: (allocationUnitAddress: number, value: number, isInteger: boolean) => {
					if (isInteger) {
						memoryViews.int32[allocationUnitAddress] = value;
						return;
					}
					memoryViews.float32[allocationUnitAddress] = value;
				},
				readClipboardText: async () => {
					return await navigator.clipboard.readText();
				},
				writeClipboardText: async (text: string) => {
					await navigator.clipboard.writeText(text);
				},
				exportCanvasScreenshot: exportCanvasScreenshot
					? async (fileName: string) => {
							view.renderFrame();
							await exportCanvasScreenshot(await getCanvasPngBlob(canvas), fileName);
						}
					: undefined,
				requestAnimationFrame: callback => window.requestAnimationFrame(callback),
				cancelAnimationFrame: id => window.cancelAnimationFrame(id),
			},
		});
		cleanups.push(() => store.dispose());
		const state = store.getState();
		cleanups.push(pointerEvents(canvas, events, state, options.captureWheel));
		cleanups.push(keyboardEvents(canvas, events, store));
		const browserWindow = canvas.ownerDocument?.defaultView ?? globalThis.window;
		cleanups.push(
			createEditorEnvironmentPluginManager(store, events, {
				window: browserWindow as Window,
				navigator: browserWindow?.navigator ?? globalThis.navigator,
				inputTarget: canvas,
				memoryViews,
				services: pluginServices.services,
			})
		);

		// Generate sprite data before initializing the view that installs and resolves the atlas.
		const spriteData = await generateSprite({
			font: state.editorConfig.font,
			colorScheme: state.editorConfig.color,
		});

		const renderProjection = createWebUiRenderProjection(store, events);
		cleanups.push(() => renderProjection.dispose());
		const getOverlayTexture = () => resolveWebUiOverlayConfig(state) ?? options.overlayTexture;

		view = await initView(state, renderProjection, canvas, memoryViews, spriteData, {
			renderStatsIntervalFrames: options.renderStatsIntervalFrames,
			overlayTexture: getOverlayTexture(),
			getCodeBuffer: () => currentCodeBuffer,
			getMemory: () => currentMemoryRef,
			onRenderStats: stats => {
				store.set('info.graphics', toGraphicsInfoRecord(stats));
			},
			onSpriteAtlasResolved: (spriteLookups, resolvedSpriteData) => {
				updateStateWithSpriteData(state, resolvedSpriteData, spriteLookups);
				renderProjection.refresh();
			},
		});
		cleanups.push(() => view.destroy());
		const syncOverlayTexture = () => {
			view.setOverlayTexture(getOverlayTexture());
		};
		store.subscribe('editorConfig.webUI', syncOverlayTexture);
		cleanups.push(() => store.unsubscribe('editorConfig.webUI', syncOverlayTexture));
		syncOverlayTexture();

		cleanups.push(createSpriteSheetManager(store, view, events));

		let currentCanvasSize: CanvasSize | null = null;
		const resize = (width: number, height: number) => {
			events.dispatch('resize', { canvasWidth: width, canvasHeight: height });
			const resized = view.resize(width, height);
			currentCanvasSize = { width, height };
			if (resized) {
				view.renderFrame();
			}
		};
		const initialCanvasSize = getCanvasDisplaySize(canvas) ?? {
			width: canvas.width,
			height: canvas.height,
		};
		const resizeObserver = browserWindow?.ResizeObserver
			? new browserWindow.ResizeObserver(() => {
					const size = getCanvasDisplaySize(canvas);
					if (!size || (size.width === currentCanvasSize?.width && size.height === currentCanvasSize.height)) {
						return;
					}

					resize(size.width, size.height);
				})
			: null;
		if (resizeObserver) cleanups.push(() => resizeObserver.disconnect());

		events.dispatch('init');
		resize(initialCanvasSize.width, initialCanvasSize.height);
		resizeObserver?.observe(canvas);
		events.dispatch('loadSession');

		return {
			resize,
			pauseRendering: () => view.pauseRendering(),
			releaseRenderingResources: () => view.releaseRenderingResources(),
			resumeRendering: () => view.resumeRendering(),
			updateMemoryViews: (memoryRef: MemoryRef) => {
				currentMemoryRef = memoryRef instanceof WebAssembly.Memory ? memoryRef : null;
				pluginServices.invalidateWasmExports();
				updateMemoryViews(memoryRef);
			},
			getMemoryViews: () => memoryViews,
			dispose,
			state,
		};
	} catch (error) {
		dispose();
		throw error;
	}
}
