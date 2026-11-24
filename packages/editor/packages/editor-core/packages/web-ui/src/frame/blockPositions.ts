import type { EditorCodeBlock, State } from '@8f4e/editor-state-types';

/** One block's presented origin in viewport-relative pixels, independent of its logical position. Frame-scoped. */
export interface FrameBlockPosition {
	readonly codeBlock: EditorCodeBlock;
	readonly x: number;
	readonly y: number;
}

/** Prepared block positions, including offscreen blocks. Read only during drawing; storage is reused next frame. */
export interface FrameBlockPositions {
	/** Block positions in drawing order. */
	readonly ordered: readonly FrameBlockPosition[];
	readonly byCodeBlock: ReadonlyMap<EditorCodeBlock, FrameBlockPosition>;
}

/** Resolve a block's visual translation in viewport pixels, or leave its position unchanged. */
export type CodeBlockOffsetResolver = (codeBlock: EditorCodeBlock) => Readonly<{ x: number; y: number }> | undefined;

/** Prepare a frame's visual translations using the renderer's high-resolution timestamp in milliseconds. */
export type CodeBlockPositionEffect = (
	state: Readonly<State>,
	frameTime: number,
	suppressOffsets: boolean
) => CodeBlockOffsetResolver | undefined;

interface StoredBlockPosition extends FrameBlockPosition {
	x: number;
	y: number;
}

/** Own one renderer's positions storage and prepare it once before each frame's drawing passes. */
export function createFrameBlockPositions() {
	const ordered: StoredBlockPosition[] = [];
	const byCodeBlock = new Map<EditorCodeBlock, StoredBlockPosition>();
	const positions: FrameBlockPositions = { ordered, byCodeBlock };
	return {
		prepare(state: State, resolveOffset?: CodeBlockOffsetResolver, { x, y } = state.viewport): FrameBlockPositions {
			const codeBlocks = state.project.activeLevel.blocks;
			let orderChanged = ordered.length !== codeBlocks.length;
			for (let i = 0; i < codeBlocks.length; i++) {
				const codeBlock = codeBlocks[i];
				let position = ordered[i];
				if (position?.codeBlock !== codeBlock) {
					orderChanged = true;
					position = byCodeBlock.get(codeBlock) ?? { codeBlock, x: 0, y: 0 };
					ordered[i] = position;
				}
				const offset = resolveOffset?.(codeBlock);
				position.x = codeBlock.x - x;
				position.y = codeBlock.y - y;
				if (offset) {
					position.x += offset.x;
					position.y += offset.y;
				}
			}
			if (orderChanged) {
				ordered.length = codeBlocks.length;
				byCodeBlock.clear();
				for (const block of ordered) byCodeBlock.set(block.codeBlock, block);
			}
			return positions;
		},
	};
}
