import type { State } from '@8f4e/editor-state-types';
import type { MemoryViews } from '../memoryViews';
import type { DrawContext } from '../sprites/drawContext';
import type { AttachedRenderLayers } from '../webgl/renderLayerRegistry';
import type { SpriteEngine } from '../webgl/spriteEngine';
import { createFrameBlockPositions } from './blockPositions';
import drawCodeBlocks from './drawCodeBlocks';
import type { FrameContext } from './frameContext';
import type { createFrameStats } from './frameStats';
import type { EditorRenderHost } from './renderRegistry';

/** Prepare and draw one frame; every drawer and layer shares the presented viewport and block positions. */
export function createFrameRenderer(
	state: State,
	engine: SpriteEngine,
	draw: DrawContext,
	memoryViews: MemoryViews,
	renderRegistry: EditorRenderHost,
	renderLayers: AttachedRenderLayers,
	stats: ReturnType<typeof createFrameStats>
) {
	const positions = createFrameBlockPositions();
	let frameContext: FrameContext;
	const beforeSprites = () => renderLayers.draw('beforeSprites', frameContext);
	const afterSprites = () => renderLayers.draw('afterSprites', frameContext);
	engine.hooks.preDraw.push(beforeSprites);
	engine.hooks.postDraw.push(afterSprites);

	const drawSprites = () => {
		const canvasFrame = { draw, ...frameContext };
		renderRegistry.drawCanvasBackground(canvasFrame);
		drawCodeBlocks(draw, state, memoryViews, renderRegistry, frameContext.blockPositions);
		if (state.featureFlags.canvasOverlays) renderRegistry.drawCanvasOverlays(canvasFrame);
		renderRegistry.drawContextMenuOverlays(canvasFrame);
		renderRegistry.drawModalOverlays(canvasFrame);
	};

	return {
		draw(frameTime: number, viewport: Readonly<State['viewport']>, suppressBlockOffsets: boolean) {
			const frameStartedAt = performance.now();
			const offsets = renderRegistry.prepareCodeBlockOffsets(state, frameTime, suppressBlockOffsets);
			const blockPositions = positions.prepare(state, offsets, viewport);
			frameContext = { state, viewport, memoryViews, blockPositions };
			engine.renderFrame(drawSprites);
			stats.emit(performance.now() - frameStartedAt);
		},
		destroy() {
			const preDrawIndex = engine.hooks.preDraw.indexOf(beforeSprites);
			if (preDrawIndex !== -1) engine.hooks.preDraw.splice(preDrawIndex, 1);
			const postDrawIndex = engine.hooks.postDraw.indexOf(afterSprites);
			if (postDrawIndex !== -1) engine.hooks.postDraw.splice(postDrawIndex, 1);
		},
	};
}
