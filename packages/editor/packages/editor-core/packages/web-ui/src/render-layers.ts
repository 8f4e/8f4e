import type { ResolvedPalette } from '@8f4e/editor-palette';
import type { State } from '@8f4e/editor-state-types';
import type { MemoryViews } from './types';

export interface RenderLayerContext {
	gl: WebGL2RenderingContext;
	palette: ResolvedPalette;
}

export interface RenderLayerFrameContext {
	state: State;
	memoryViews: MemoryViews;
}

/** A canvas-wide pass drawn above sprites and below the configured texture overlay. */
export interface EditorRenderLayer {
	draw: (context: RenderLayerFrameContext) => void;
	loadPalette?: (palette: ResolvedPalette) => void;
	releaseMemory?: () => void;
	destroy: () => void;
}

export type RenderLayerFactory = (context: RenderLayerContext) => EditorRenderLayer;

function destroyLayers(layers: Iterable<EditorRenderLayer>): void {
	const errors: unknown[] = [];
	for (const layer of layers) {
		try {
			layer.destroy();
		} catch (error) {
			errors.push(error);
		}
	}
	if (errors.length) throw new AggregateError(errors, 'Render layer cleanup failed');
}

/** Registrations can precede renderer initialization or arrive later through lazy plugins. */
export function createRenderLayerRegistry() {
	const registrations = new Set<{ factory: RenderLayerFactory; layer?: EditorRenderLayer }>();
	let context: RenderLayerContext | undefined;
	let memoryReleased = false;
	return {
		registerRenderLayer: (factory: RenderLayerFactory): (() => void) => {
			const registration: { factory: RenderLayerFactory; layer?: EditorRenderLayer } = { factory };
			if (context) {
				registration.layer = factory(context);
				try {
					if (memoryReleased) registration.layer.releaseMemory?.();
				} catch (error) {
					registration.layer.destroy();
					throw error;
				}
			}
			registrations.add(registration);
			return () => {
				registrations.delete(registration);
				const layer = registration.layer;
				registration.layer = undefined;
				layer?.destroy();
			};
		},
		attachRenderLayers: (initialContext: RenderLayerContext) => {
			if (context) throw new Error('Render layers are already attached');
			context = initialContext;
			memoryReleased = false;
			let destroyed = false;
			const destroy = () => {
				if (destroyed) return;
				destroyed = true;
				context = undefined;
				const layers: EditorRenderLayer[] = [];
				for (const registration of registrations) {
					if (registration.layer) layers.push(registration.layer);
					registration.layer = undefined;
				}
				destroyLayers(layers.reverse());
			};
			try {
				for (const registration of registrations) registration.layer = registration.factory(initialContext);
			} catch (error) {
				try {
					destroy();
				} catch (cleanupError) {
					throw new AggregateError([error, cleanupError], 'Render layer initialization failed');
				}
				throw error;
			}
			return {
				draw: (frame: RenderLayerFrameContext) => {
					if (destroyed) return;
					memoryReleased = false;
					for (const { layer } of registrations) layer?.draw(frame);
				},
				loadPalette: (palette: ResolvedPalette) => {
					if (destroyed) return;
					if (context) context = { ...context, palette };
					for (const { layer } of registrations) layer?.loadPalette?.(palette);
				},
				releaseMemory: () => {
					if (destroyed || memoryReleased) return;
					memoryReleased = true;
					for (const { layer } of registrations) layer?.releaseMemory?.();
				},
				destroy,
			};
		},
	};
}
