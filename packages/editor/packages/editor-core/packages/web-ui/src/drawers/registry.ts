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

export interface CanvasOverlayDrawerContext {
	/** Drawing coordinates are relative to the viewport's top-left corner. */
	draw: DrawContext;
	state: State;
	memoryViews: MemoryViews;
}

export type CanvasOverlayDrawer = (context: CanvasOverlayDrawerContext) => void;

/** Registrations exposed to editor plugins. */
export interface EditorDrawerRegistry {
	/** Register a GPU layer whose resources are bound to the renderer lifecycle. */
	registerRenderLayer: (factory: RenderLayerFactory) => () => void;
	/** Draw inside the block after its background/highlights and before its cursor and diagnostics. */
	registerCodeBlockContentDrawer: (drawer: CodeBlockDrawer) => () => void;
	/** Draw after the block content, cursor, and error messages. */
	registerCodeBlockDrawer: (drawer: CodeBlockDrawer) => () => void;
	/** Draw after block drawers, inside the same block group. */
	registerCodeBlockOverlay: (drawer: CodeBlockDrawer) => () => void;
	/** Draw over editor content and menus, before dialogs, using viewport coordinates. */
	registerCanvasOverlay: (drawer: CanvasOverlayDrawer) => () => void;
}

/** Renderer-owned invocation and lifecycle of registered drawers and layers. */
export interface EditorDrawerHost extends EditorDrawerRegistry {
	attachRenderLayers: ReturnType<typeof createRenderLayerRegistry>['attachRenderLayers'];
	drawCodeBlockContent: CodeBlockDrawer;
	drawCodeBlock: CodeBlockDrawer;
	drawCodeBlockOverlay: CodeBlockDrawer;
	drawCanvasOverlays: CanvasOverlayDrawer;
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
	const content = createDrawerSlot<CodeBlockDrawerContext>();
	const widgets = createDrawerSlot<CodeBlockDrawerContext>();
	const overlays = createDrawerSlot<CodeBlockDrawerContext>();
	const canvasOverlays = createDrawerSlot<CanvasOverlayDrawerContext>();
	return {
		...createRenderLayerRegistry(),
		registerCodeBlockContentDrawer: content.register,
		registerCodeBlockDrawer: widgets.register,
		registerCodeBlockOverlay: overlays.register,
		registerCanvasOverlay: canvasOverlays.register,
		drawCodeBlockContent: content.draw,
		drawCodeBlock: widgets.draw,
		drawCodeBlockOverlay: overlays.draw,
		drawCanvasOverlays: canvasOverlays.draw,
	};
}
