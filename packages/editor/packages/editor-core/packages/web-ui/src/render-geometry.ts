import type { EditorCodeBlock, State } from '@8f4e/editor-state-types';

/** One block's presented origin in viewport-relative pixels, independent of its logical position. Frame-scoped. */
export interface RenderedCodeBlock {
	readonly codeBlock: EditorCodeBlock;
	readonly x: number;
	readonly y: number;
}

/** Prepared block positions, including offscreen blocks. Read only during drawing; storage is reused next frame. */
export interface RenderGeometry {
	/** Blocks in drawing order. */
	readonly blocks: readonly RenderedCodeBlock[];
	readonly blocksByCodeBlock: ReadonlyMap<EditorCodeBlock, RenderedCodeBlock>;
}

/** Resolve a block's visual translation in viewport pixels, or leave its position unchanged. */
export type CodeBlockOffsetResolver = (codeBlock: EditorCodeBlock) => Readonly<{ x: number; y: number }> | undefined;

/** Prepare a frame's visual translations using the renderer's high-resolution timestamp in milliseconds. */
export type CodeBlockPositionEffect = (
	state: Readonly<State>,
	frameTime: number,
	suppressOffsets: boolean
) => CodeBlockOffsetResolver | undefined;

interface StoredBlockGeometry extends RenderedCodeBlock {
	x: number;
	y: number;
}

/** Own one renderer's geometry storage and prepare it once before each frame's drawing passes. */
export function createRenderGeometry() {
	const blocks: StoredBlockGeometry[] = [];
	const blocksByCodeBlock = new Map<EditorCodeBlock, StoredBlockGeometry>();
	const geometry: RenderGeometry = { blocks, blocksByCodeBlock };
	return {
		prepare(state: State, resolveOffset?: CodeBlockOffsetResolver, { x, y } = state.viewport): RenderGeometry {
			const codeBlocks = state.project.activeLevel.blocks;
			let orderChanged = blocks.length !== codeBlocks.length;
			for (let i = 0; i < codeBlocks.length; i++) {
				const codeBlock = codeBlocks[i];
				let renderedBlock = blocks[i];
				if (renderedBlock?.codeBlock !== codeBlock) {
					orderChanged = true;
					renderedBlock = blocksByCodeBlock.get(codeBlock) ?? { codeBlock, x: 0, y: 0 };
					blocks[i] = renderedBlock;
				}
				const offset = resolveOffset?.(codeBlock);
				renderedBlock.x = codeBlock.x - x;
				renderedBlock.y = codeBlock.y - y;
				if (offset) {
					renderedBlock.x += offset.x;
					renderedBlock.y += offset.y;
				}
			}
			if (orderChanged) {
				blocks.length = codeBlocks.length;
				blocksByCodeBlock.clear();
				for (const block of blocks) blocksByCodeBlock.set(block.codeBlock, block);
			}
			return geometry;
		},
	};
}
