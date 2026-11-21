import type {
	CodeBlockGraphicData,
	CodeBlockOffsetResolver,
	CodeBlockPositionEffect,
	EditorPlugin,
	ProjectLevel,
} from '@8f4e/editor-core';
import {
	advanceViewportSpring,
	createViewportSpring,
	MAX_OFFSET_PIXELS,
	resetViewportSpring,
	type ViewportSpring,
} from './spring';

const MAX_FRAME_GAP_MS = 150;
const MAX_CAMERA_STEP_PIXELS = 240;
const SIZE_PROFILES = [
	{ gridCells: 80, frequency: 26, influence: 0.22 },
	{ gridCells: 200, frequency: 21, influence: 0.35 },
	{ gridCells: 500, frequency: 17, influence: 0.5 },
	{ gridCells: 900, frequency: 13, influence: 0.64 },
] as const;
const MAX_BLOCK_OFFSET_PIXELS = Math.ceil(
	MAX_OFFSET_PIXELS * Math.max(...SIZE_PROFILES.map(profile => profile.influence))
);

interface SpringBlend {
	gridCells: number;
	from: ViewportSpring;
	to: ViewportSpring;
	fromWeight: number;
	toWeight: number;
}

function createPositionEffect(prefersReducedMotion: () => boolean) {
	// Keep shared responses current so blocks can start using them as soon as they approach the viewport.
	const springs = SIZE_PROFILES.map(({ frequency }) => createViewportSpring(frequency));
	const blendsByBlock = new WeakMap<CodeBlockGraphicData, SpringBlend>();
	let previousProject: ProjectLevel | undefined;
	let previousTime: number | undefined;
	let viewportX = 0;
	let viewportY = 0;
	let vGrid = 0;
	let hGrid = 0;
	let wasInteractionSuppressed = false;
	let moving = false;
	let left = 0;
	let right = 0;
	let top = 0;
	let bottom = 0;

	const prepareBlends = (blocks: readonly CodeBlockGraphicData[], cellArea: number) => {
		for (const block of blocks) {
			const gridCells = (block.width * block.height) / cellArea;
			if (blendsByBlock.get(block)?.gridCells === gridCells) continue;
			let upper = 0;
			while (upper < SIZE_PROFILES.length - 1 && gridCells > SIZE_PROFILES[upper].gridCells) upper++;
			const lower = Math.max(0, upper - 1);
			const from = SIZE_PROFILES[lower];
			const to = SIZE_PROFILES[upper];
			const mix = upper === lower ? 0 : Math.min(1, (gridCells - from.gridCells) / (to.gridCells - from.gridCells));
			blendsByBlock.set(block, {
				gridCells,
				from: springs[lower],
				to: springs[upper],
				fromWeight: (1 - mix) * from.influence,
				toWeight: mix * to.influence,
			});
		}
	};

	// The renderer consumes each offset before resolving the next block.
	const offset = { x: 0, y: 0 };
	const resolveOffset: CodeBlockOffsetResolver = block => {
		if (block.x >= right || block.y >= bottom || block.x + block.width <= left || block.y + block.height <= top) return;
		const blend = blendsByBlock.get(block);
		if (!blend) return;
		const { from, to, fromWeight, toWeight } = blend;
		// Keep glyphs and decorations aligned on whole pixels without rounding the simulation or its blend.
		offset.x = Math.round(from.x * fromWeight + to.x * toWeight) || 0;
		offset.y = Math.round(from.y * fromWeight + to.y * toWeight) || 0;
		return offset.x || offset.y ? offset : undefined;
	};

	const effect: CodeBlockPositionEffect = (state, frameTime, suppressOffsets) => {
		const { viewport, codeBlockRendering } = state;
		const { currentProject, draggedCodeBlock } = codeBlockRendering;
		const elapsedMs = previousTime === undefined ? 0 : frameTime - previousTime;
		const dx = viewport.x - viewportX;
		const dy = viewport.y - viewportY;
		const interactionSuppressed = prefersReducedMotion() || draggedCodeBlock !== undefined;
		const reset =
			previousTime === undefined ||
			currentProject !== previousProject ||
			viewport.vGrid !== vGrid ||
			viewport.hGrid !== hGrid ||
			elapsedMs < 0 ||
			elapsedMs > MAX_FRAME_GAP_MS ||
			dx ** 2 + dy ** 2 > MAX_CAMERA_STEP_PIXELS ** 2 ||
			suppressOffsets ||
			interactionSuppressed ||
			wasInteractionSuppressed;

		previousProject = currentProject;
		previousTime = frameTime;
		viewportX = viewport.x;
		viewportY = viewport.y;
		vGrid = viewport.vGrid;
		hGrid = viewport.hGrid;
		wasInteractionSuppressed = interactionSuppressed;

		if (reset) {
			if (moving) for (const spring of springs) resetViewportSpring(spring);
			moving = false;
			return;
		}
		if (!moving && dx === 0 && dy === 0) return;

		moving = false;
		let hasOffset = false;
		for (let i = 0; i < springs.length; i++) {
			const spring = springs[i];
			if (advanceViewportSpring(spring, elapsedMs / 1000, dx, dy)) moving = true;
			if (Math.max(Math.abs(spring.x), Math.abs(spring.y)) * SIZE_PROFILES[i].influence >= 0.5) hasOffset = true;
		}
		if (!hasOffset) return;
		// Only move blocks whose bounds could intersect the viewport after applying the largest spring offset.
		left = viewport.x - MAX_BLOCK_OFFSET_PIXELS;
		right = viewport.x + viewport.width + MAX_BLOCK_OFFSET_PIXELS;
		top = viewport.y - MAX_BLOCK_OFFSET_PIXELS;
		bottom = viewport.y + viewport.height + MAX_BLOCK_OFFSET_PIXELS;
		return resolveOffset;
	};
	return { effect, prepareBlends };
}

/** Creates a render-only elastic viewport effect, with motion preference supplied by the host. */
export function createElasticViewportPlugin({
	prefersReducedMotion,
}: {
	prefersReducedMotion: () => boolean;
}): EditorPlugin {
	return {
		id: 'elastic-viewport',
		setup: ({ store, events, drawers }) => {
			const state = store.getState();
			const { effect, prepareBlends } = createPositionEffect(prefersReducedMotion);
			const refresh = ({ codeBlocks }: { codeBlocks: readonly CodeBlockGraphicData[] }) => {
				const { vGrid, hGrid } = state.viewport;
				prepareBlends(codeBlocks, Math.max(1, vGrid * hGrid));
			};
			refresh({ codeBlocks: state.codeBlockRendering.currentProject.blocks });
			events.on('codeBlockLayoutsChanged', refresh);
			const unregister = drawers.registerCodeBlockPositionEffect(effect);
			return () => {
				events.off('codeBlockLayoutsChanged', refresh);
				unregister();
			};
		},
	};
}
