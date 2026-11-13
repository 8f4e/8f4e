import { readFile } from 'node:fs/promises';
import { compileProject, parseProjectSource } from '@8f4e/compiler';
import { describe, expect, it } from 'vitest';
import { resolveStdlibInclude } from '../src/shared/stdlibResolver';

const WIDTH = 128;
const HEIGHT = 128;

function packFrame(frame: Uint8Array): Uint8Array {
	const packed = new Uint8Array(frame.length / 8);
	for (let pixel = 0; pixel < frame.length; pixel++) {
		if (frame[pixel]) packed[pixel >> 3] |= 0x80 >> (pixel & 7);
	}
	return packed;
}

function evolveFrame(previous: Uint8Array): Uint8Array {
	const counts = new Uint8Array(previous.length);
	// Each live cell contributes to neighbors across the wrapped edges.
	for (let y = 0; y < HEIGHT; y++) {
		for (let x = 0; x < WIDTH; x++) {
			if (!previous[y * WIDTH + x]) continue;
			for (let dy = -1; dy <= 1; dy++) {
				for (let dx = -1; dx <= 1; dx++) {
					if (dx === 0 && dy === 0) continue;
					const nx = (x + dx + WIDTH) % WIDTH;
					const ny = (y + dy + HEIGHT) % HEIGHT;
					counts[ny * WIDTH + nx]++;
				}
			}
		}
	}
	return Uint8Array.from(previous, (alive, index) => Number(counts[index] === 3 || (alive && counts[index] === 2)));
}

async function loadExample(offset: number) {
	const source = await readFile(
		new URL('../../examples/src/projects/visuals/gameOfLife.8f4e', import.meta.url),
		'utf8'
	);
	const result = await compileProject(parseProjectSource(source), {
		startingMemoryAllocationUnitAddress: offset,
		resolveInclude: resolveStdlibInclude,
	});
	const pages = Math.max(1, Math.ceil(result.requiredMemoryBytes / 65536));
	const memory = new WebAssembly.Memory({ initial: pages, maximum: pages, shared: true });
	const bytes = new Uint8Array(memory.buffer);
	bytes.fill(0xa5);
	const { instance } = await WebAssembly.instantiate(new Uint8Array(result.codeBuffer), { host: { memory } });
	(instance.exports.initDefaults as () => void)();
	const screen = result.memoryPlan.modules.screen.memory;
	const controls = result.memoryPlan.modules.simulation.memory;
	const view = new DataView(memory.buffer);
	const writeControl = (name: keyof typeof controls, value: number) =>
		view.setInt32(controls[name].byteAddress, value, true);
	const readControl = (name: keyof typeof controls) => view.getInt32(controls[name].byteAddress, true);
	const frameAddress = () =>
		screen.display ? view.getInt32(screen.display.byteAddress, true) : readControl('current');
	const frame = () => bytes.slice(frameAddress(), frameAddress() + (WIDTH * HEIGHT) / 8);
	return {
		bytes,
		screen,
		controls,
		writeControl,
		readControl,
		frame,
		frameAddress,
		step: instance.exports.main as () => void,
	};
}

describe('Game of Life example', () => {
	it.each([0, 9])('evolves patterns across wrapped edges at memory offset %i', async offset => {
		const { bytes, screen, readControl, frame: displayedFrame, frameAddress, step } = await loadExample(offset);
		step();
		let frame = new Uint8Array(WIDTH * HEIGHT);
		const patterns = [
			// A still life, a blinker across a byte boundary, and a glider.
			[
				32,
				32,
				[
					[0, 0],
					[1, 0],
					[0, 1],
					[1, 1],
				],
			],
			[
				7,
				16,
				[
					[0, 0],
					[1, 0],
					[2, 0],
				],
			],
			[
				64,
				64,
				[
					[1, 0],
					[2, 1],
					[0, 2],
					[1, 2],
					[2, 2],
				],
			],
			// Blinkers straddling the horizontal and vertical seams.
			[
				WIDTH - 1,
				48,
				[
					[0, 0],
					[1, 0],
					[2, 0],
				],
			],
			[
				48,
				HEIGHT - 1,
				[
					[0, 0],
					[0, 1],
					[0, 2],
				],
			],
			// Live corners and byte boundaries exercise all eight neighbor directions.
			[
				0,
				0,
				[
					[0, 0],
					[1, 0],
					[0, 1],
				],
			],
			[
				125,
				125,
				[
					[1, 0],
					[2, 1],
					[0, 2],
					[1, 2],
					[2, 2],
				],
			],
			[
				0,
				80,
				[
					[0, 0],
					[0, 1],
					[0, 2],
					[1, 2],
				],
			],
			[
				80,
				0,
				[
					[0, 0],
					[1, 0],
					[2, 0],
					[2, 1],
				],
			],
		] as const;
		for (const [originX, originY, cells] of patterns) {
			for (const [x, y] of cells) frame[((originY + y) % HEIGHT) * WIDTH + ((originX + x) % WIDTH)] = 1;
		}
		expect(screen.mono.numberOfElements).toBe((WIDTH * HEIGHT) / 8);
		expect(screen.next.numberOfElements).toBe((WIDTH * HEIGHT) / 8);
		bytes.set(packFrame(frame), frameAddress());
		const prefix = bytes.slice(0, offset * 4);
		for (let generation = 1; generation <= 40; generation++) {
			frame = evolveFrame(frame);
			const packed = packFrame(frame);

			step();
			expect(
				displayedFrame().findIndex((value, index) => value !== packed[index]),
				`generation ${generation}: displayed pixels`
			).toBe(-1);
			expect(readControl('generation')).toBe(generation);
			expect(bytes.slice(0, offset * 4)).toEqual(prefix);
		}
	});

	it.each([0, 9])('keeps a glider moving through both seams at memory offset %i', async offset => {
		const { bytes, frame, frameAddress, step } = await loadExample(offset);
		step();
		const glider = [
			[1, 0],
			[2, 1],
			[0, 2],
			[1, 2],
			[2, 2],
		];
		const translatedFrame = (distance: number) => {
			const cells = new Uint8Array(WIDTH * HEIGHT);
			for (const [x, y] of glider) {
				const nx = (WIDTH - 3 + x + distance) % WIDTH;
				const ny = (HEIGHT - 3 + y + distance) % HEIGHT;
				cells[ny * WIDTH + nx] = 1;
			}
			return packFrame(cells);
		};
		bytes.set(translatedFrame(0), frameAddress());
		// Every four generations a glider translates one cell diagonally,
		// including when it crosses the right and bottom boundaries.
		for (let distance = 1; distance <= 8; distance++) {
			for (let generation = 0; generation < 4; generation++) step();
			expect(frame(), `translation ${distance}`).toEqual(translatedFrame(distance));
		}
	});

	it.each([0, 9])('supports deterministic seeding, pause, resume and restart at memory offset %i', async offset => {
		const { bytes, writeControl, readControl, frame, step } = await loadExample(offset);
		step();
		const initial = frame();
		expect(initial.some(value => value !== 0)).toBe(true);
		expect(readControl('generation')).toBe(0);
		for (let y = 0; y < HEIGHT; y++) {
			for (let x = 0; x < WIDTH; x++) {
				if (x >= WIDTH / 4 && x < (WIDTH * 3) / 4 && y >= HEIGHT / 4 && y < (HEIGHT * 3) / 4) continue;
				const pixel = y * WIDTH + x;
				expect((initial[pixel >> 3] >> (7 - (pixel & 7))) & 1).toBe(0);
			}
		}
		step();
		expect(readControl('generation')).toBe(1);
		expect(frame()).not.toEqual(initial);
		writeControl('running', 0);
		const paused = bytes.slice();
		step();
		step();
		expect(bytes).toEqual(paused);
		const pausedFrame = frame();
		writeControl('seed', 42);
		step();
		expect(frame()).toEqual(pausedFrame);
		writeControl('restart', 1);
		step();
		const anotherSeed = frame();
		expect(anotherSeed).not.toEqual(initial);
		expect(readControl('generation')).toBe(0);
		expect(readControl('restart')).toBe(0);
		writeControl('seed', 1);
		writeControl('restart', 1);
		step();
		expect(frame()).toEqual(initial);
		writeControl('running', 1);
		step();
		expect(readControl('generation')).toBe(1);
	});
	it.each([0, 9])('publishes complete buffers without copying over the old frame at offset %i', async offset => {
		const { bytes, screen, controls, frame, frameAddress, readControl, step } = await loadExample(offset);
		step();
		for (let generation = 1; generation <= 4; generation++) {
			const oldFront = frameAddress();
			const oldBack = readControl('next');
			const previousFrame = frame();
			const expected = bytes.slice();
			step();
			expect(frameAddress()).toBe(oldBack);
			expect(readControl('current')).toBe(oldBack);
			expect(readControl('next')).toBe(oldFront);
			expect(bytes.slice(oldFront, oldFront + previousFrame.length)).toEqual(previousFrame);
			expected.set(frame(), oldBack);
			const expectedView = new DataView(expected.buffer);
			expectedView.setInt32(controls.current.byteAddress, oldBack, true);
			expectedView.setInt32(controls.next.byteAddress, oldFront, true);
			expectedView.setInt32(screen.display.byteAddress, oldBack, true);
			expectedView.setInt32(controls.generation.byteAddress, generation, true);
			expect(bytes.findIndex((value, index) => value !== expected[index])).toBe(-1);
		}
	});
});
