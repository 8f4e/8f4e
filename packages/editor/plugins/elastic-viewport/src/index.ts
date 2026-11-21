import type { CodeBlockOffsetResolver, CodeBlockPositionEffect, EditorPlugin, ProjectLevel } from '@8f4e/editor-core';
import { advanceViewportSpring, createViewportSpring, resetViewportSpring } from './spring';

const MAX_FRAME_GAP_MS = 150;
const MAX_CAMERA_STEP_PIXELS = 240;
const SIZE_PROFILES = [
	{ gridCells: 80, frequency: 26, influence: 0.22 },
	{ gridCells: 200, frequency: 21, influence: 0.35 },
	{ gridCells: 500, frequency: 17, influence: 0.5 },
	{ gridCells: 900, frequency: 13, influence: 0.64 },
] as const;

function createPositionEffect(prefersReducedMotion: () => boolean): CodeBlockPositionEffect {
	// Simulate four reference responses to the same camera motion, including for blocks outside the viewport.
	const springs = SIZE_PROFILES.map(({ frequency }) => createViewportSpring(frequency));
	let previousProject: ProjectLevel | undefined;
	let previousTime: number | undefined;
	let viewportX = 0;
	let viewportY = 0;
	let vGrid = 0;
	let hGrid = 0;
	let cellArea = 1;
	let wasInteractionSuppressed = false;
	let moving = false;

	// The renderer consumes each offset before resolving the next block.
	const offset = { x: 0, y: 0 };
	const resolveOffset: CodeBlockOffsetResolver = block => {
		const gridCells = (block.width * block.height) / cellArea;
		let upper = 0;
		while (upper < SIZE_PROFILES.length - 1 && gridCells > SIZE_PROFILES[upper].gridCells) upper++;
		const lower = Math.max(0, upper - 1);
		const from = SIZE_PROFILES[lower];
		const to = SIZE_PROFILES[upper];
		const mix = upper === lower ? 0 : Math.min(1, (gridCells - from.gridCells) / (to.gridCells - from.gridCells));
		const fromWeight = (1 - mix) * from.influence;
		const toWeight = mix * to.influence;
		// Keep glyphs and decorations aligned on whole pixels without rounding the simulation or its blend.
		offset.x = Math.round(springs[lower].x * fromWeight + springs[upper].x * toWeight) || 0;
		offset.y = Math.round(springs[lower].y * fromWeight + springs[upper].y * toWeight) || 0;
		return offset.x || offset.y ? offset : undefined;
	};

	return (state, frameTime, suppressOffsets) => {
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
		cellArea = Math.max(1, vGrid * hGrid);
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
		return hasOffset ? resolveOffset : undefined;
	};
}

/** Creates a render-only elastic viewport effect, with motion preference supplied by the host. */
export function createElasticViewportPlugin({
	prefersReducedMotion,
}: {
	prefersReducedMotion: () => boolean;
}): EditorPlugin {
	return {
		id: 'elastic-viewport',
		setup: ({ drawers }) => drawers.registerCodeBlockPositionEffect(createPositionEffect(prefersReducedMotion)),
	};
}
