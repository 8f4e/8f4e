import type { State } from '@8f4e/editor-state-types';
import type { AttachedRenderLayers } from './renderLayerRegistry';
import type { SpriteEngine } from './spriteEngine';

/** Defer canvas resizing while sprite and render layer memory is suspended. */
export function createResourceLifecycle(
	engine: SpriteEngine,
	renderLayers: AttachedRenderLayers,
	viewport: Readonly<State['viewport']>
) {
	let width = engine.gl.drawingBufferWidth || viewport.width || 1;
	let height = engine.gl.drawingBufferHeight || viewport.height || 1;
	let released = false;
	return {
		resize(nextWidth: number, nextHeight: number) {
			width = nextWidth;
			height = nextHeight;
			if (released) return false;
			engine.resize(width, height);
			return true;
		},
		release() {
			if (released) return;
			renderLayers.releaseMemory();
			engine.releaseRenderingMemory();
			released = true;
			engine.resize(1, 1);
		},
		restore() {
			if (!released) return;
			engine.restoreRenderingMemory();
			engine.resize(width, height);
			released = false;
		},
	};
}
