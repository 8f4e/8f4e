import type { CodeBlockGraphicData, State } from '@8f4e/editor-state-types';
import type { DrawContext } from '../drawContext';
import { createRenderLayerRegistry, type RenderLayerFactory } from '../render-layers';
import type { MemoryViews } from '../types';

export interface CodeBlockDrawerContext {
	/** Drawing coordinates are relative to the visible code block. */
	draw: DrawContext;
	state: State;
	codeBlock: CodeBlockGraphicData;
	memoryViews: MemoryViews;
}

export type CodeBlockDrawer = (context: CodeBlockDrawerContext) => void;

/** Draw one offscreen block's decoration using world coordinates. */
export type OffscreenCodeBlockDrawer = (draw: DrawContext, codeBlock: CodeBlockGraphicData, state: State) => void;

export interface CanvasDrawerContext {
	/** Drawing coordinates are relative to the viewport's top-left corner. */
	draw: DrawContext;
	state: State;
	memoryViews: MemoryViews;
}

export type CanvasDrawer = (context: CanvasDrawerContext) => void;

/** Registrations exposed to editor plugins. */
export interface EditorDrawerRegistry {
	/** Register a GPU layer whose resources are bound to the renderer lifecycle. */
	registerRenderLayer: (factory: RenderLayerFactory) => () => void;
	/** Draw inside each visible block, in registration order. */
	registerCodeBlockDrawer: (drawer: CodeBlockDrawer) => () => void;
	/** Register backgrounds drawn by the source-text painter above nested shading and below selection and text. */
	registerCodeBlockTextBackgroundDrawer: (drawer: CodeBlockDrawer) => () => void;
	/** Invoke registered text backgrounds from a source-text painter inside its ordinary block drawer. */
	drawCodeBlockTextBackgrounds: CodeBlockDrawer;
	/** Replace the offscreen drawer. Disposal clears the slot if this registration still owns it. */
	registerOffscreenCodeBlockDrawer: (drawer: OffscreenCodeBlockDrawer) => () => void;
	/** Draw below code blocks, using viewport coordinates. */
	registerCanvasBackgroundDrawer: (drawer: CanvasDrawer) => () => void;
	/** Draw above code blocks and below overlays, using viewport coordinates. */
	registerCanvasDrawer: (drawer: CanvasDrawer) => () => void;
	/** Draw over ordinary canvas contents, before modal overlays, using viewport coordinates. */
	registerCanvasOverlay: (drawer: CanvasDrawer) => () => void;
	/** Draw context menus above ordinary overlays and below dialogs, independently of canvasOverlays. */
	registerContextMenuOverlay: (drawer: CanvasDrawer) => () => void;
	/** Draw above ordinary canvas overlays, independently of the canvasOverlays flag. */
	registerModalOverlay: (drawer: CanvasDrawer) => () => void;
}

/** Renderer-owned invocation and lifecycle of registered drawers and layers. */
export interface EditorDrawerHost extends EditorDrawerRegistry {
	attachRenderLayers: ReturnType<typeof createRenderLayerRegistry>['attachRenderLayers'];
	drawCodeBlock: CodeBlockDrawer;
	drawOffscreenCodeBlock: OffscreenCodeBlockDrawer;
	drawCanvasBackground: CanvasDrawer;
	drawCanvas: CanvasDrawer;
	drawCanvasOverlays: CanvasDrawer;
	drawContextMenuOverlays: CanvasDrawer;
	drawModalOverlays: CanvasDrawer;
}

function createOrderedDrawerRegistry<Context>() {
	const registrations = new Set<{ drawer: (context: Context) => void }>();
	return {
		register: (drawer: (context: Context) => void) => {
			const registration = { drawer };
			registrations.add(registration);
			return () => {
				registrations.delete(registration);
			};
		},
		draw: (context: Context) => {
			for (const { drawer } of registrations) drawer(context);
		},
	};
}

export function createEditorDrawerRegistry(): EditorDrawerHost {
	let offscreenDrawer: OffscreenCodeBlockDrawer | undefined;
	const blockDrawers = createOrderedDrawerRegistry<CodeBlockDrawerContext>();
	const textBackgrounds = createOrderedDrawerRegistry<CodeBlockDrawerContext>();
	const canvasBackground = createOrderedDrawerRegistry<CanvasDrawerContext>();
	const canvas = createOrderedDrawerRegistry<CanvasDrawerContext>();
	const canvasOverlays = createOrderedDrawerRegistry<CanvasDrawerContext>();
	const contextMenuOverlays = createOrderedDrawerRegistry<CanvasDrawerContext>();
	const modalOverlays = createOrderedDrawerRegistry<CanvasDrawerContext>();
	return {
		...createRenderLayerRegistry(),
		registerCodeBlockDrawer: blockDrawers.register,
		registerCodeBlockTextBackgroundDrawer: textBackgrounds.register,
		drawCodeBlockTextBackgrounds: textBackgrounds.draw,
		registerOffscreenCodeBlockDrawer: drawer => {
			offscreenDrawer = drawer;
			return () => {
				if (offscreenDrawer === drawer) offscreenDrawer = undefined;
			};
		},
		registerCanvasBackgroundDrawer: canvasBackground.register,
		registerCanvasDrawer: canvas.register,
		registerCanvasOverlay: canvasOverlays.register,
		registerContextMenuOverlay: contextMenuOverlays.register,
		registerModalOverlay: modalOverlays.register,
		drawCodeBlock: blockDrawers.draw,
		drawOffscreenCodeBlock: (draw, codeBlock, state) => offscreenDrawer?.(draw, codeBlock, state),
		drawCanvasBackground: canvasBackground.draw,
		drawCanvas: canvas.draw,
		drawCanvasOverlays: canvasOverlays.draw,
		drawContextMenuOverlays: contextMenuOverlays.draw,
		drawModalOverlays: modalOverlays.draw,
	};
}
