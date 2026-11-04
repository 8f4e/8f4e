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
	/** Draw above the block surface, below line selection, corners, and content. */
	registerCodeBlockBackgroundDrawer: (drawer: CodeBlockDrawer) => () => void;
	/** Draw inside the block after backgrounds and selection, before foreground drawings. */
	registerCodeBlockContentDrawer: (drawer: CodeBlockDrawer) => () => void;
	/** Draw above content and shapes. */
	registerCodeBlockForegroundDrawer: (drawer: CodeBlockDrawer) => () => void;
	/** Draw after foreground drawings. */
	registerCodeBlockDrawer: (drawer: CodeBlockDrawer) => () => void;
	/** Draw after block drawers, inside the same block group. */
	registerCodeBlockOverlay: (drawer: CodeBlockDrawer) => () => void;
	/** Draw over editor content and menus, before dialogs, using viewport coordinates. */
	registerCanvasOverlay: (drawer: CanvasOverlayDrawer) => () => void;
	/** Draw above ordinary canvas overlays, independently of the canvasOverlays flag. */
	registerModalOverlay: (drawer: CanvasOverlayDrawer) => () => void;
}

/** Renderer-owned invocation and lifecycle of registered drawers and layers. */
export interface EditorDrawerHost extends EditorDrawerRegistry {
	attachRenderLayers: ReturnType<typeof createRenderLayerRegistry>['attachRenderLayers'];
	drawCodeBlockBackground: CodeBlockDrawer;
	drawCodeBlockContent: CodeBlockDrawer;
	drawCodeBlockForeground: CodeBlockDrawer;
	drawCodeBlock: CodeBlockDrawer;
	drawCodeBlockOverlay: CodeBlockDrawer;
	drawCanvasOverlays: CanvasOverlayDrawer;
	drawModalOverlays: CanvasOverlayDrawer;
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
	const background = createDrawerSlot<CodeBlockDrawerContext>();
	const content = createDrawerSlot<CodeBlockDrawerContext>();
	const foreground = createDrawerSlot<CodeBlockDrawerContext>();
	const widgets = createDrawerSlot<CodeBlockDrawerContext>();
	const overlays = createDrawerSlot<CodeBlockDrawerContext>();
	const canvasOverlays = createDrawerSlot<CanvasOverlayDrawerContext>();
	const modalOverlays = createDrawerSlot<CanvasOverlayDrawerContext>();
	return {
		...createRenderLayerRegistry(),
		registerCodeBlockBackgroundDrawer: background.register,
		registerCodeBlockContentDrawer: content.register,
		registerCodeBlockForegroundDrawer: foreground.register,
		registerCodeBlockDrawer: widgets.register,
		registerCodeBlockOverlay: overlays.register,
		registerCanvasOverlay: canvasOverlays.register,
		registerModalOverlay: modalOverlays.register,
		drawCodeBlockBackground: background.draw,
		drawCodeBlockContent: content.draw,
		drawCodeBlockForeground: foreground.draw,
		drawCodeBlock: widgets.draw,
		drawCodeBlockOverlay: overlays.draw,
		drawCanvasOverlays: canvasOverlays.draw,
		drawModalOverlays: modalOverlays.draw,
	};
}
