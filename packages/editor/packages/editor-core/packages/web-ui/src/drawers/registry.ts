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
	/** Draw above code blocks and below overlays, using viewport coordinates. */
	registerCanvasDrawer: (drawer: CanvasDrawer) => () => void;
	/** Draw over ordinary canvas contents, before modal overlays, using viewport coordinates. */
	registerCanvasOverlay: (drawer: CanvasDrawer) => () => void;
	/** Draw above ordinary canvas overlays, independently of the canvasOverlays flag. */
	registerModalOverlay: (drawer: CanvasDrawer) => () => void;
}

/** Renderer-owned invocation and lifecycle of registered drawers and layers. */
export interface EditorDrawerHost extends EditorDrawerRegistry {
	attachRenderLayers: ReturnType<typeof createRenderLayerRegistry>['attachRenderLayers'];
	drawCodeBlock: CodeBlockDrawer;
	drawCanvas: CanvasDrawer;
	drawCanvasOverlays: CanvasDrawer;
	drawModalOverlays: CanvasDrawer;
}

function createDrawerSlot<Context>() {
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
	const blockDrawers = createDrawerSlot<CodeBlockDrawerContext>();
	const canvas = createDrawerSlot<CanvasDrawerContext>();
	const canvasOverlays = createDrawerSlot<CanvasDrawerContext>();
	const modalOverlays = createDrawerSlot<CanvasDrawerContext>();
	return {
		...createRenderLayerRegistry(),
		registerCodeBlockDrawer: blockDrawers.register,
		registerCanvasDrawer: canvas.register,
		registerCanvasOverlay: canvasOverlays.register,
		registerModalOverlay: modalOverlays.register,
		drawCodeBlock: blockDrawers.draw,
		drawCanvas: canvas.draw,
		drawCanvasOverlays: canvasOverlays.draw,
		drawModalOverlays: modalOverlays.draw,
	};
}
