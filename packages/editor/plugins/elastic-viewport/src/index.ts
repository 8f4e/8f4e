import type {
	CodeBlockOffsetResolver,
	CodeBlockPositionEffect,
	EditorCodeBlock,
	EditorPlugin,
	ProjectLevel,
} from '@8f4e/editor-core';
import { createEntryMotion } from './entry-motion';
import {
	type ElasticViewportPluginOptions,
	type ResolvedElasticViewportOptions,
	resolveElasticViewportOptions,
} from './options';
import { createViewportSpring, createViewportSpringSolver, resetViewportSpring, type ViewportSpring } from './spring';

export type {
	ElasticViewportEntryOptions,
	ElasticViewportPanOptions,
	ElasticViewportPluginOptions,
	ElasticViewportSizeProfile,
	ElasticViewportSpringOptions,
} from './options';

interface SpringBlend {
	gridCells: number;
	from: ViewportSpring;
	to: ViewportSpring;
	fromWeight: number;
	toWeight: number;
}

function createPositionEffect(options: ResolvedElasticViewportOptions) {
	const {
		prefersReducedMotion,
		maxFrameGapMs,
		maxCameraStepPixels,
		pan,
		spring: springOptions,
		entry: entryOptions,
	} = options;
	const { sizeProfiles, maxOffsetPixels } = pan;
	const maxCameraStepSquared = maxCameraStepPixels ** 2;
	const reach = Math.ceil(maxOffsetPixels * Math.max(...sizeProfiles.map(profile => profile.influence)));
	// Keep shared responses current so blocks can start using them as soon as they approach the viewport.
	const springProfiles = sizeProfiles.map(profile => ({
		...profile,
		spring: createViewportSpring(),
		advance: createViewportSpringSolver(profile.frequency, maxOffsetPixels, springOptions),
	}));
	const blendsByBlock = new WeakMap<EditorCodeBlock, SpringBlend>();
	const entry = createEntryMotion(entryOptions, springOptions);
	let previousLevel: ProjectLevel | undefined;
	let previousTime: number | undefined;
	let viewportX = 0;
	let viewportY = 0;
	let viewportWidth = 0;
	let viewportHeight = 0;
	let vGrid = 0;
	let hGrid = 0;
	let wasInteractionSuppressed = false;
	let moving = false;
	let pendingCameraChange: 'pan' | 'jump' | undefined;
	let useEntryMotion = false;
	let hasSharedOffset = false;
	let left = 0;
	let right = 0;
	let top = 0;
	let bottom = 0;
	const onViewportChanged = ({ source }: { source?: 'navigation' | 'pan' }) => {
		// Don't treat a frame containing both a jump and a pan as a continuous pan.
		pendingCameraChange = source === 'pan' && pendingCameraChange !== 'jump' ? 'pan' : 'jump';
	};

	const prepareBlends = (blocks: readonly EditorCodeBlock[], cellArea: number) => {
		for (const block of blocks) {
			const gridCells = (block.width * block.height) / cellArea;
			if (blendsByBlock.get(block)?.gridCells === gridCells) continue;
			let upper = 0;
			while (upper < springProfiles.length - 1 && gridCells > springProfiles[upper].gridCells) upper++;
			const lower = Math.max(0, upper - 1);
			const from = springProfiles[lower];
			const to = springProfiles[upper];
			const mix = upper === lower ? 0 : Math.min(1, (gridCells - from.gridCells) / (to.gridCells - from.gridCells));
			blendsByBlock.set(block, {
				gridCells,
				from: from.spring,
				to: to.spring,
				fromWeight: (1 - mix) * from.influence,
				toWeight: mix * to.influence,
			});
		}
	};

	// The renderer consumes each offset before resolving the next block.
	const offset = { x: 0, y: 0 };
	const resolveOffset: CodeBlockOffsetResolver = block => {
		if (block.x >= right || block.y >= bottom || block.x + block.width <= left || block.y + block.height <= top) return;
		offset.x = 0;
		offset.y = 0;
		if (hasSharedOffset) {
			const blend = blendsByBlock.get(block);
			if (blend) {
				const { from, to, fromWeight, toWeight } = blend;
				// Keep glyphs and decorations aligned on whole pixels without rounding the simulation or its blend.
				offset.x = Math.round(from.x * fromWeight + to.x * toWeight) || 0;
				offset.y = Math.round(from.y * fromWeight + to.y * toWeight) || 0;
			}
		}
		if (useEntryMotion) entry.resolve(block, offset);
		return offset.x || offset.y ? offset : undefined;
	};

	const effect: CodeBlockPositionEffect = (state, frameTime, suppressOffsets) => {
		const { viewport, project } = state;
		const { activeLevel, draggedCodeBlock } = project;
		const previousX = viewportX;
		const previousY = viewportY;
		const elapsedMs = previousTime === undefined ? 0 : frameTime - previousTime;
		const dx = viewport.x - previousX;
		const dy = viewport.y - previousY;
		const moved = dx !== 0 || dy !== 0;
		const resized = viewport.width !== viewportWidth || viewport.height !== viewportHeight;
		const manualPan = moved && pendingCameraChange === 'pan' && !resized;
		if (resized || pendingCameraChange === 'jump' || (moved && !manualPan)) entry.reset();
		pendingCameraChange = undefined;
		const interactionSuppressed = prefersReducedMotion() || draggedCodeBlock !== undefined;
		const reset =
			previousTime === undefined ||
			activeLevel !== previousLevel ||
			viewport.vGrid !== vGrid ||
			viewport.hGrid !== hGrid ||
			elapsedMs < 0 ||
			elapsedMs > maxFrameGapMs ||
			dx ** 2 + dy ** 2 > maxCameraStepSquared ||
			suppressOffsets ||
			interactionSuppressed ||
			wasInteractionSuppressed;

		previousLevel = activeLevel;
		previousTime = frameTime;
		viewportX = viewport.x;
		viewportY = viewport.y;
		viewportWidth = viewport.width;
		viewportHeight = viewport.height;
		vGrid = viewport.vGrid;
		hGrid = viewport.hGrid;
		wasInteractionSuppressed = interactionSuppressed;

		if (reset) {
			if (moving) for (const { spring } of springProfiles) resetViewportSpring(spring);
			moving = false;
			entry.reset();
			return;
		}
		useEntryMotion = manualPan || entry.hasMotion();
		if (!moving && !moved && !useEntryMotion) return;
		if (useEntryMotion) entry.beginFrame(previousX, previousY, viewport, frameTime, elapsedMs, manualPan);

		moving = false;
		hasSharedOffset = false;
		const elapsedSeconds = elapsedMs / 1000;
		for (const { spring, advance, influence } of springProfiles) {
			if (advance(spring, elapsedSeconds, dx, dy)) moving = true;
			if (Math.max(Math.abs(spring.x), Math.abs(spring.y)) * influence >= 0.5) hasSharedOffset = true;
		}
		if (!hasSharedOffset && !useEntryMotion) return;
		// Entry motion only applies to logically visible blocks. Only ordinary lag can draw an offscreen block.
		left = viewport.x - reach;
		right = viewport.x + viewport.width + reach;
		top = viewport.y - reach;
		bottom = viewport.y + viewport.height + reach;
		return resolveOffset;
	};
	return { effect, prepareBlends, onViewportChanged };
}

/** Creates a render-only elastic viewport effect, with motion preference supplied by the host. */
export function createElasticViewportPlugin(options: ElasticViewportPluginOptions): EditorPlugin {
	const tuning = resolveElasticViewportOptions(options);
	return {
		id: 'elastic-viewport',
		setup: ({ store, events, drawers }) => {
			const state = store.getState();
			const { effect, prepareBlends, onViewportChanged } = createPositionEffect(tuning);
			const refresh = ({ codeBlocks }: { codeBlocks: readonly EditorCodeBlock[] }) => {
				const { vGrid, hGrid } = state.viewport;
				prepareBlends(codeBlocks, Math.max(1, vGrid * hGrid));
			};
			refresh({ codeBlocks: state.project.activeLevel.blocks });
			events.on('codeBlockLayoutsChanged', refresh);
			events.on('viewportChanged', onViewportChanged);
			const unregister = drawers.registerCodeBlockPositionEffect(effect);
			return () => {
				events.off('codeBlockLayoutsChanged', refresh);
				events.off('viewportChanged', onViewportChanged);
				unregister();
			};
		},
	};
}
