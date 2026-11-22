import { EventEmitter } from 'node:events';
import type { CodeBlockGraphicData, EditorPlugin } from '@8f4e/editor-core';
import initState, { EMPTY_DEFAULT_PROJECT, updateViewport } from '@8f4e/editor-state';
import { createMockCodeBlock, createMockViewport } from '@8f4e/editor-state-testing';
import { createEditorDrawerRegistry } from '@8f4e/web-ui';
import { afterEach, describe, expect, it } from 'vitest';
import { createElasticViewportPlugin } from './index';

const cleanups: (() => void)[] = [];
afterEach(() => {
	while (cleanups.length) cleanups.pop()?.();
});

function setup(plugin: EditorPlugin = createElasticViewportPlugin({ prefersReducedMotion: () => false })) {
	const emitter = new EventEmitter();
	const events = { on: emitter.on.bind(emitter), off: emitter.off.bind(emitter), dispatch: emitter.emit.bind(emitter) };
	const store = initState(events, { initialGridSize: { vGrid: 8, hGrid: 16 }, callbacks: {} });
	const drawers = createEditorDrawerRegistry();
	const state = store.getState();
	state.viewport = createMockViewport();
	const small = createMockCodeBlock({ x: 300, y: 100, width: 80, height: 64 });
	const large = createMockCodeBlock({ width: 384, height: 224, creationIndex: 1 });
	state.codeBlockRendering.currentProject.blocks.push(small, large);
	const dispose = plugin.setup({
		store,
		events,
		menus: store.menus,
		directives: store.directives,
		layout: store.layout,
		loading: store.loading,
		drawers,
	});
	cleanups.push(store.dispose, dispose);
	const frame = (time: number, suppressOffsets = false) =>
		drawers.prepareCodeBlockOffsets(state, time, suppressOffsets);
	const pan = (dx: number, dy = 0) => {
		state.viewport.x += dx;
		state.viewport.y += dy;
	};
	const manualPan = (dx: number, dy = 0) =>
		updateViewport(state, state.viewport.x + dx, state.viewport.y + dy, events, 'pan');
	const settle = (...codeBlocks: CodeBlockGraphicData[]) =>
		events.dispatch('codeBlockLayoutsChanged', { project: state.codeBlockRendering.currentProject, codeBlocks });
	return { state, events, emitter, small, large, dispose, frame, pan, manualPan, settle };
}

describe('elastic viewport plugin', () => {
	it('lags, overshoots, and settles in both axes without altering logical positions', () => {
		const { state, small, large, frame, pan } = setup();
		expect(frame(0)).toBeUndefined();
		pan(34, -34);
		const start = frame(16);
		expect(start?.(small)).toEqual({ x: 7, y: -7 });
		expect(start?.(large)).toEqual({ x: 19, y: -19 });

		const catchUp = frame(96)!;
		const { x: smallX, y: smallY } = catchUp(small)!;
		const { x: largeX, y: largeY } = catchUp(large)!;
		expect(smallX).toBeGreaterThan(0);
		expect(smallX).toBeLessThan(largeX);
		expect(largeX).toBeLessThan(19);
		expect(smallY).toBeLessThan(0);
		expect(smallY).toBeGreaterThan(largeY);

		const smallOvershoot = frame(166);
		expect(smallOvershoot?.(small)).toEqual({ x: -1, y: 1 });
		expect(smallOvershoot?.(large)?.x).toBeGreaterThan(0);
		frame(246);
		const largeOvershoot = frame(326)?.(large)?.x;
		expect(largeOvershoot).toBeLessThan(0);
		expect(largeOvershoot).toBeGreaterThan(-4);
		for (let time = 406; time <= 886; time += 80) frame(time);
		expect(frame(900)).toBeUndefined();
		expect(small).toMatchObject({ x: 300, y: 100 });
		expect(state.viewport).toMatchObject({ x: 34, y: -34 });
	});

	it('uses elapsed time rather than the number of frames to settle', () => {
		const sample = (frameCount: number) => {
			const { small, large, frame, pan } = setup();
			frame(0);
			pan(40, 20);
			frame(20);
			for (let i = 1; i < frameCount; i++) frame(20 + (85 * i) / frameCount);
			const offset = frame(105);
			const smallOffset = offset?.(small);
			const smallCoordinates = smallOffset && { ...smallOffset };
			const largeOffset = offset?.(large);
			return { small: smallCoordinates, large: largeOffset && { ...largeOffset } };
		};
		const slower = sample(8);
		expect(slower.small).toBeDefined();
		expect(slower.large).toBeDefined();
		expect(slower).toEqual(sample(16));
	});

	it('limits the diagonal rendering displacement during a fast pan', () => {
		const { small, frame, pan } = setup();
		frame(0);
		pan(120, 120);
		const offset = frame(16)?.(small);
		expect(offset).toEqual({ x: 7, y: 7 });
	});

	it('skips distant blocks but keeps offsets for offscreen blocks that could enter view', () => {
		const { state, frame, pan, settle } = setup();
		const { width: viewportWidth, height: viewportHeight } = state.viewport;
		const width = 640;
		const height = 256;
		const panX = 80;
		const block = (x: number, y: number, creationIndex: number) =>
			createMockCodeBlock({ x, y, width, height, creationIndex });
		// The largest spring offset can bring the near block one pixel into view. The other blocks are just out of reach.
		const near = block(panX - width - 30, 100, 2);
		const far = [
			block(panX - width - 31, 100, 3),
			block(panX + viewportWidth + 31, 100, 4),
			block(200, -height - 31, 5),
			block(200, viewportHeight + 31, 6),
		];
		state.codeBlockRendering.currentProject.blocks.push(near, ...far);
		settle(near, ...far);
		frame(0);
		pan(panX);
		const offset = frame(16);
		expect(offset?.(near)).toEqual({ x: 31, y: 0 });
		for (const block of far) expect(offset?.(block)).toBeUndefined();
	});

	it('holds an entering block only when the viewport moves through manual panning', () => {
		const sample = (manual: boolean) => {
			const { state, frame, pan, manualPan, settle } = setup();
			const block = createMockCodeBlock({ x: state.viewport.width + 4, y: 100, width: 80, height: 64 });
			state.codeBlockRendering.currentProject.blocks.push(block);
			settle(block);
			frame(0);
			(manual ? manualPan : pan)(12);
			const offset = frame(16)?.(block)?.x ?? 0;
			return block.x - state.viewport.x + offset - state.viewport.width;
		};
		expect(sample(true)).toBe(0);
		expect(sample(false)).toBeLessThan(0);
	});

	it('discards held entries when a navigation frame suppresses offsets', () => {
		const { state, frame, manualPan, settle } = setup();
		const block = createMockCodeBlock({ x: state.viewport.width + 4, y: 100, width: 80, height: 64 });
		state.codeBlockRendering.currentProject.blocks.push(block);
		settle(block);
		frame(0);
		manualPan(12);
		expect(frame(16)?.(block)).toEqual({ x: 8, y: 0 });
		expect(frame(32, true)).toBeUndefined();
		expect(frame(48)).toBeUndefined();
	});

	it('preserves weight differences even when a sustained fast pan saturates the springs', () => {
		const { state, small, frame, pan, settle } = setup();
		const largest = createMockCodeBlock({ width: 640, height: 256, creationIndex: 3 });
		state.codeBlockRendering.currentProject.blocks.push(largest);
		settle(largest);
		frame(0);
		for (let i = 1; i < 18; i++) {
			pan(20);
			frame(i * (1000 / 60));
		}
		pan(20);
		const offset = frame(300);
		expect(offset?.(small)).toEqual({ x: 11, y: 0 });
		expect(offset?.(largest)).toEqual({ x: 31, y: 0 });
	});

	it('blends between response profiles for blocks with nearby sizes', () => {
		const sample = (width: number, height: number) => {
			const { small, frame, pan, settle } = setup();
			Object.assign(small, { width, height });
			settle(small);
			frame(0);
			pan(40);
			return frame(16)?.(small)?.x;
		};
		expect([sample(80, 64), sample(128, 130), sample(128, 180)]).toEqual([9, 11, 13]);
	});

	it('gives equally sized blocks the same lag regardless of their identity', () => {
		const { state, small, frame, pan, settle } = setup();
		const twin = createMockCodeBlock({ width: small.width, height: small.height, creationIndex: 3 });
		state.codeBlockRendering.currentProject.blocks.push(twin);
		settle(twin);
		frame(0);
		pan(40, 20);
		for (const time of [16, 64, 160]) {
			const offset = frame(time)!;
			// Copy the first result because the resolver reuses its offset object.
			const expected = { ...offset(small) };
			expect(offset(twin)).toEqual(expected);
		}
	});

	it('prepares revised blend weights from settled block dimensions and font grid', () => {
		const { state, small, frame, pan, settle } = setup();
		frame(0);
		pan(40);
		const offset = frame(16);
		expect(offset?.(small)).toEqual({ x: 9, y: 0 });

		Object.assign(small, { width: 128, height: 180 });
		// Drawing only needs the prepared weights, not geometry that is still being settled.
		expect(offset?.(small)).toEqual({ x: 9, y: 0 });
		settle(small);
		expect(offset?.(small)).toEqual({ x: 13, y: 0 });

		state.viewport.vGrid *= 2;
		settle(small);
		expect(frame(32)).toBeUndefined();
		pan(40);
		expect(frame(48)?.(small)).toEqual({ x: 9, y: 0 });
	});

	it('prepares blends for settled blocks when entering a group after loading a project', () => {
		const { state, events, frame, pan } = setup();
		events.dispatch('loadProject', {
			project: {
				...EMPTY_DEFAULT_PROJECT,
				execution: [
					{
						...EMPTY_DEFAULT_PROJECT,
						type: 'group',
						id: 0,
						name: 'audio',
						code: ['group audio', 'groupEnd'],
						entry: 'main',
						exposures: [],
						execution: [{ type: 'module', id: 1, entry: 'main', code: ['module child', 'moduleEnd'] }],
					},
				],
			},
		});
		const group = state.codeBlockRendering.currentProject.blocks.find(block => block.name === 'audio')!;
		events.dispatch('openProjectGroup', { codeBlock: group });
		const child = state.codeBlockRendering.currentProject.blocks.find(block => block.name === 'child')!;
		frame(0);
		pan(40);
		expect(frame(16)?.(child)).toEqual({ x: 9, y: 0 });
	});

	it.each(['project change', 'font grid change', 'camera jump', 'long frame gap'] as const)(
		'clears residual motion on a %s',
		reason => {
			const { state, small, frame, pan } = setup();
			frame(0);
			pan(40);
			expect(frame(16)?.(small)).toBeDefined();
			let time = 32;
			switch (reason) {
				case 'project change':
					state.codeBlockRendering.currentProject = { ...state.codeBlockRendering.currentProject };
					pan(40);
					break;
				case 'font grid change':
					state.viewport.vGrid += 2;
					pan(40);
					break;
				case 'camera jump':
					pan(250);
					break;
				case 'long frame gap':
					time = 300;
					pan(40);
					break;
			}
			expect(frame(time)).toBeUndefined();
			pan(15);
			expect(frame(time + 16)?.(small)).toEqual({ x: 3, y: 0 });
		}
	);

	it('resets during camera suppression and springs on the next manual pan', () => {
		const { small, frame, pan } = setup();
		frame(0);
		pan(40);
		expect(frame(16)?.(small)).toBeDefined();
		pan(80);
		expect(frame(32, true)).toBeUndefined();
		expect(frame(48, true)).toBeUndefined();
		pan(15);
		expect(frame(64)?.(small)).toEqual({ x: 3, y: 0 });
	});

	it.each(['direct dragging', 'reduced motion'] as const)(
		'suppresses the effect during and immediately after %s',
		reason => {
			let reducedMotion = false;
			const { state, small, frame, pan } = setup(
				createElasticViewportPlugin({ prefersReducedMotion: () => reducedMotion })
			);
			frame(0);
			pan(40);
			expect(frame(16)?.(small)).toBeDefined();

			const suppress = (enabled: boolean) => {
				if (reason === 'direct dragging') state.codeBlockRendering.draggedCodeBlock = enabled ? small : undefined;
				if (reason === 'reduced motion') reducedMotion = enabled;
			};
			suppress(true);
			pan(20);
			expect(frame(32)).toBeUndefined();
			pan(20);
			expect(frame(48)).toBeUndefined();
			suppress(false);
			pan(20);
			expect(frame(64)).toBeUndefined();
			pan(15);
			expect(frame(80)?.(small)).toEqual({ x: 3, y: 0 });
		}
	);

	it('starts at rest at an existing camera position and ignores movement of a block itself', () => {
		const { small, frame, pan } = setup();
		pan(80, 40);
		expect(frame(0)).toBeUndefined();
		small.x += 40;
		expect(frame(16)).toBeUndefined();
	});

	it('uses the configured pan cap and profile for blocks outside the default rendering reach', () => {
		const profile = { gridCells: 80, frequency: 26, influence: 1 };
		const panOptions = { maxOffsetPixels: 80, sizeProfiles: [profile] as const };
		const plugin = createElasticViewportPlugin({ prefersReducedMotion: () => false, pan: panOptions });
		// Later edits to the caller's settings do not change the constructed plugin.
		panOptions.maxOffsetPixels = 24;
		profile.influence = 0.5;
		const { state, frame, pan, settle } = setup(plugin);
		const near = createMockCodeBlock({ x: 120 - 80 - 70, y: 100, width: 80, height: 64 });
		const beyond = createMockCodeBlock({ x: near.x - 10, y: 100, width: 80, height: 64 });
		state.codeBlockRendering.currentProject.blocks.push(near, beyond);
		settle(near, beyond);
		frame(0);
		pan(120);
		const offset = frame(16);
		expect(offset?.(near)).toEqual({ x: 80, y: 0 });
		expect(offset?.(beyond)).toBeUndefined();
	});

	it('allows a bouncier pan response or critical damping without overshoot', () => {
		const sample = (dampingRatio: number) => {
			const { frame, pan, small } = setup(
				createElasticViewportPlugin({ prefersReducedMotion: () => false, spring: { dampingRatio } })
			);
			frame(0);
			pan(48);
			const offsets = [];
			for (let time = 16; time <= 512; time += 16) offsets.push(frame(time)?.(small)?.x ?? 0);
			return offsets;
		};
		const bouncy = sample(0.25);
		const critical = sample(1);
		expect(critical[0]).toBeGreaterThan(0);
		expect(bouncy[0]).toBe(critical[0]);
		expect(Math.min(...bouncy)).toBeLessThan(-1);
		expect(Math.min(...critical)).toBe(0);
		expect(critical.at(-1)).toBe(0);
	});

	it.each(['pull', 'idle'] as const)('releases an entry at the configured %s threshold', reason => {
		const { state, frame, manualPan, settle } = setup(
			createElasticViewportPlugin({
				prefersReducedMotion: () => false,
				entry: { releaseDistancePixels: 24, idleReleaseMs: 32, frequency: 40 },
			})
		);
		const block = createMockCodeBlock({ x: state.viewport.width + 4, y: 100, width: 80, height: 64 });
		state.codeBlockRendering.currentProject.blocks.push(block);
		settle(block);
		const visibleDepth = (time: number) =>
			state.viewport.x + state.viewport.width - block.x - (frame(time)?.(block)?.x ?? 0);
		frame(0);
		manualPan(12);
		expect(visibleDepth(16)).toBe(0);
		if (reason === 'pull') {
			manualPan(25);
			expect(visibleDepth(32)).toBeGreaterThan(0);
		} else {
			expect(visibleDepth(47)).toBe(0);
			expect(visibleDepth(48)).toBe(0);
			expect(visibleDepth(80)).toBeGreaterThan(0);
		}
	});

	it('applies the configured camera-step and frame-gap guards independently', () => {
		const { frame, pan, small } = setup(
			createElasticViewportPlugin({ prefersReducedMotion: () => false, maxCameraStepPixels: 55, maxFrameGapMs: 45 })
		);
		frame(0);
		pan(55);
		expect(frame(16)?.(small)?.x).toBeGreaterThan(0);
		pan(56);
		expect(frame(32)).toBeUndefined();
		pan(20);
		expect(frame(77)?.(small)?.x).toBeGreaterThan(0);
		pan(20);
		expect(frame(123)).toBeUndefined();
	});

	it('owns isolated state per installation and unregisters drawing and layout notifications on disposal', () => {
		const plugin = createElasticViewportPlugin({ prefersReducedMotion: () => false });
		const first = setup(plugin);
		const second = setup(plugin);
		first.frame(0);
		second.frame(0);
		first.pan(40);
		second.pan(-20);
		expect(first.frame(16)?.(first.small)).toEqual({ x: 9, y: 0 });
		expect(second.frame(16)?.(second.small)).toEqual({ x: -4, y: 0 });

		const listeners = first.emitter.listenerCount('codeBlockLayoutsChanged');
		first.dispose();
		expect(first.emitter.listenerCount('codeBlockLayoutsChanged')).toBe(listeners - 1);
		expect(first.frame(32)).toBeUndefined();
		expect(second.frame(32)?.(second.small)?.x).toBeLessThan(0);
	});
});
