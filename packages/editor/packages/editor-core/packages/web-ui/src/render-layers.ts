import type { ResolvedPalette } from '@8f4e/editor-palette';
import type { State } from '@8f4e/editor-state-types';
import type { Font, FontAtlas } from '@8f4e/sprite-generator';
import type { RenderGeometry } from './render-geometry';
import type { MemoryViews } from './types';

export type RenderLayerStage = 'beforeSprites' | 'afterSprites';

/** The font actually installed in the renderer, not a pending font selection. */
export interface RenderLayerFont {
	name: Font;
	grid: FontAtlas['grid'];
}

export interface RenderLayerContext {
	gl: WebGL2RenderingContext;
	palette: ResolvedPalette;
	font: RenderLayerFont;
}

export interface RenderLayerFrameContext {
	state: State;
	/** The presented camera and metrics for this frame. Do not retain across frames. */
	viewport: Readonly<State['viewport']>;
	memoryViews: MemoryViews;
	renderGeometry: RenderGeometry;
}

/** A canvas-wide pass drawn in its registered stage, in plugin registration order. */
export interface EditorRenderLayer {
	draw: (context: RenderLayerFrameContext) => void;
	loadPalette?: (palette: ResolvedPalette) => void;
	loadFont?: (font: RenderLayerFont) => void;
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
	interface Registration {
		stage: RenderLayerStage;
		factory: RenderLayerFactory;
		layer?: EditorRenderLayer;
	}
	const registrations = new Set<Registration>();
	let context: RenderLayerContext | undefined;
	let memoryReleased = false;
	return {
		registerRenderLayer: (stage: RenderLayerStage, factory: RenderLayerFactory): (() => void) => {
			const registration: Registration = { stage, factory };
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
				draw: (stage: RenderLayerStage, frame: RenderLayerFrameContext) => {
					if (destroyed) return;
					memoryReleased = false;
					for (const registration of registrations) {
						if (registration.stage === stage) registration.layer?.draw(frame);
					}
				},
				loadPalette: (palette: ResolvedPalette) => {
					if (destroyed) return;
					if (context) context = { ...context, palette };
					for (const { layer } of registrations) layer?.loadPalette?.(palette);
				},
				loadFont: (font: RenderLayerFont) => {
					if (destroyed) return;
					if (context) context = { ...context, font };
					for (const { layer } of registrations) layer?.loadFont?.(font);
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
