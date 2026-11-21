import type { CodeBlockGraphicData, State } from '@8f4e/editor-state-types';

/** One block's presented origin in viewport-relative pixels, independent of its logical position. */
export interface RenderedCodeBlock {
	readonly codeBlock: CodeBlockGraphicData;
	readonly x: number;
	readonly y: number;
}

/** Prepared block positions for one frame, including blocks outside the viewport. */
export interface RenderGeometry {
	/** Blocks in drawing order. */
	readonly blocks: readonly RenderedCodeBlock[];
	readonly blocksByCodeBlock: ReadonlyMap<CodeBlockGraphicData, RenderedCodeBlock>;
}

/** Resolve each block's presented position once, before any of the frame's drawing passes. */
export function createRenderGeometry(state: State): RenderGeometry {
	const blocks: RenderedCodeBlock[] = [];
	const blocksByCodeBlock = new Map<CodeBlockGraphicData, RenderedCodeBlock>();
	const { x, y } = state.viewport;

	for (const codeBlock of state.codeBlockRendering.currentProject.blocks) {
		const renderedBlock = { codeBlock, x: codeBlock.x - x, y: codeBlock.y - y };
		blocks.push(renderedBlock);
		blocksByCodeBlock.set(codeBlock, renderedBlock);
	}
	return { blocks, blocksByCodeBlock };
}
