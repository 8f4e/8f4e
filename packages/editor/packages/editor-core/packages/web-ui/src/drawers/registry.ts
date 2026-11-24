import type { EditorCodeBlock, State } from '@8f4e/editor-state-types';
import type { DrawContext } from '../drawContext';
import type { CodeBlockPositionEffect, RenderedCodeBlock, RenderGeometry } from '../render-geometry';
import { createRenderLayerRegistry, type RenderLayerFactory, type RenderLayerStage } from '../render-layers';
import type { MemoryViews } from '../types';

export interface CodeBlockDrawerContext {
	/** Drawing coordinates are relative to the visible block's presented origin. */
	draw: DrawContext;
	state: State;
	codeBlock: EditorCodeBlock;
	memoryViews: MemoryViews;
}

export type CodeBlockDrawer = (context: CodeBlockDrawerContext) => void;

/** Draw one offscreen block's decoration using viewport coordinates and frame-scoped geometry. */
export type OffscreenCodeBlockDrawer = (draw: DrawContext, renderedBlock: RenderedCodeBlock, state: State) => void;

export interface CanvasDrawerContext {
	/** Drawing coordinates are relative to the viewport's top-left corner. */
	draw: DrawContext;
	state: State;
	/** The world origin and metrics used for this frame's drawing. Do not retain across frames. */
	viewport: Readonly<State['viewport']>;
	memoryViews: MemoryViews;
	renderGeometry: RenderGeometry;
}

export type CanvasDrawer = (context: CanvasDrawerContext) => void;

/** Registrations exposed to editor plugins. */
export interface EditorDrawerRegistry {
	/** Replace the presentation-only block position effect. Disposal clears only this registration. */
	registerCodeBlockPositionEffect: (effect: CodeBlockPositionEffect) => () => void;
	/** Register a GPU layer at a sprite boundary; its resources are bound to the renderer lifecycle. */
	registerRenderLayer: (stage: RenderLayerStage, factory: RenderLayerFactory) => () => void;
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
	prepareCodeBlockOffsets: (
		state: Parameters<CodeBlockPositionEffect>[0],
		frameTime: number,
		suppressOffsets?: boolean
	) => ReturnType<CodeBlockPositionEffect>;
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
	let positionEffect: { effect: CodeBlockPositionEffect } | undefined;
	const blockDrawers = createOrderedDrawerRegistry<CodeBlockDrawerContext>();
	const textBackgrounds = createOrderedDrawerRegistry<CodeBlockDrawerContext>();
	const canvasBackground = createOrderedDrawerRegistry<CanvasDrawerContext>();
	const canvas = createOrderedDrawerRegistry<CanvasDrawerContext>();
	const canvasOverlays = createOrderedDrawerRegistry<CanvasDrawerContext>();
	const contextMenuOverlays = createOrderedDrawerRegistry<CanvasDrawerContext>();
	const modalOverlays = createOrderedDrawerRegistry<CanvasDrawerContext>();
	return {
		...createRenderLayerRegistry(),
		registerCodeBlockPositionEffect: effect => {
			const registration = { effect };
			positionEffect = registration;
			return () => {
				if (positionEffect === registration) positionEffect = undefined;
			};
		},
		prepareCodeBlockOffsets: (state, frameTime, suppressOffsets = false) => {
			const offsets = positionEffect?.effect(state, frameTime, suppressOffsets);
			return suppressOffsets ? undefined : offsets;
		},
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
		drawOffscreenCodeBlock: (draw, renderedBlock, state) => offscreenDrawer?.(draw, renderedBlock, state),
		drawCanvasBackground: canvasBackground.draw,
		drawCanvas: canvas.draw,
		drawCanvasOverlays: canvasOverlays.draw,
		drawContextMenuOverlays: contextMenuOverlays.draw,
		drawModalOverlays: modalOverlays.draw,
	};
}
