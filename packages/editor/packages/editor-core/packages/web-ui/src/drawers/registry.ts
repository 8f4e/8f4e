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

export interface EditorDrawerRegistry {
	/** Register a GPU layer whose resources are bound to the renderer lifecycle. */
	registerRenderLayer: (factory: RenderLayerFactory) => () => void;
	/** Draw after error messages and before built-in block widgets. */
	registerCodeBlockDrawer: (drawer: CodeBlockDrawer) => () => void;
	/** Draw after all built-in block widgets, inside the same block group. */
	registerCodeBlockOverlay: (drawer: CodeBlockDrawer) => () => void;
}

export interface CodeBlockDrawerRegistry extends EditorDrawerRegistry {
	attachRenderLayers: ReturnType<typeof createRenderLayerRegistry>['attachRenderLayers'];
	drawCodeBlock: CodeBlockDrawer;
	drawCodeBlockOverlay: CodeBlockDrawer;
}

function createDrawerSlot() {
	const registrations = new Set<{ drawer: CodeBlockDrawer }>();
	return {
		register: (drawer: CodeBlockDrawer) => {
			const registration = { drawer };
			registrations.add(registration);
			return () => {
				registrations.delete(registration);
			};
		},
		draw: (context: CodeBlockDrawerContext) => {
			for (const { drawer } of registrations) drawer(context);
		},
	};
}

export function createCodeBlockDrawerRegistry(): CodeBlockDrawerRegistry {
	const widgets = createDrawerSlot();
	const overlays = createDrawerSlot();
	return {
		...createRenderLayerRegistry(),
		registerCodeBlockDrawer: widgets.register,
		registerCodeBlockOverlay: overlays.register,
		drawCodeBlock: widgets.draw,
		drawCodeBlockOverlay: overlays.draw,
	};
}
