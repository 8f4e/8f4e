import { readFile } from 'node:fs/promises';
import { compileProject, parseProjectSource } from '@8f4e/compiler';
import { describe, expect, it } from 'vitest';
import { resolveStdlibInclude } from '../src/shared/stdlibResolver';
import { loadExample } from './exampleRuntime';

const WIDTH = 256;
const HEIGHT = 256;

function expectedFrame(rule: number, seed: number): Uint8Array {
	const frame = new Uint8Array(WIDTH * HEIGHT);
	for (let bit = 0; bit < 8; bit++) {
		frame[WIDTH - 8 + bit] = ((seed >> (7 - bit)) & 1) * 255;
	}
	for (let y = 1; y < HEIGHT; y++) {
		const previousRow = (y - 1) * WIDTH;
		for (let x = 0; x < WIDTH; x++) {
			const left = x > 0 && frame[previousRow + x - 1] !== 0 ? 4 : 0;
			const center = frame[previousRow + x] !== 0 ? 2 : 0;
			const right = x < WIDTH - 1 && frame[previousRow + x + 1] !== 0 ? 1 : 0;
			frame[y * WIDTH + x] = ((rule >> (left | center | right)) & 1) * 255;
		}
	}
	return frame;
}

function packFrame(frame: Uint8Array): Uint8Array {
	const packed = new Uint8Array(frame.length / 8);
	for (let pixel = 0; pixel < frame.length; pixel++) {
		if (frame[pixel]) packed[pixel >> 3] |= 0x80 >> (pixel & 7);
	}
	return packed;
}

describe('Elementary cellular automata example', () => {
	it.each([0, 9])(
		'packs pixels correctly across rule and seed changes with memory allocation offset %i',
		async offset => {
			const source = await readFile(
				new URL('../../examples/src/projects/visuals/elementaryCellularAutomata.8f4e', import.meta.url),
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

			const framebuffer = result.memoryPlan.modules.screen.memory.mono;
			expect(framebuffer.numberOfElements).toBe((WIDTH * HEIGHT) / 8);
			const ruleAddress = result.memoryPlan.modules.patternGenerator.memory.rule.byteAddress;
			const seedAddress = result.memoryPlan.modules.patternGenerator.memory.seed.byteAddress;
			const prefix = bytes.slice(0, offset * 4);
			const tail = bytes.slice(result.requiredMemoryBytes);
			for (const [rule, seed] of [
				[110, 1],
				[110, 0],
				[110, 2],
				[110, 0x80],
				[110, 0x81],
				[110, 0xaa],
				[110, 255],
				[102, 0x55],
				[109, 3],
				[0, 255],
				[255, 0],
				[30, 0xa5],
				[90, 0xf0],
				[110, 1],
			]) {
				bytes.fill(0xa5, framebuffer.byteAddress, framebuffer.endByteAddress);
				new DataView(memory.buffer).setInt32(ruleAddress, rule, true);
				new DataView(memory.buffer).setInt32(seedAddress, seed, true);
				const expected = packFrame(expectedFrame(rule, seed));
				(instance.exports.main as () => void)();
				expect(
					bytes
						.subarray(framebuffer.byteAddress, framebuffer.endByteAddress)
						.findIndex((value, index) => value !== expected[index]),
					`rule ${rule}, seed ${seed}`
				).toBe(-1);
				expect(bytes.slice(0, offset * 4)).toEqual(prefix);
				expect(bytes.slice(result.requiredMemoryBytes)).toEqual(tail);
			}
		}
	);
	it.each([0, 9])('caches unchanged controls and renders each independent change at offset %i', async offset => {
		const runtime = await loadExample('visuals/elementaryCellularAutomata.8f4e', source => source, offset);
		const controls = runtime.modules.patternGenerator.memory;
		const image = runtime.modules.screen.memory.mono;
		const frame = () => runtime.bytes.slice(image.byteAddress, image.endByteAddress);
		const write = (name: string, value: number) => runtime.view.setInt32(controls[name].byteAddress, value, true);
		write('rule', 0);
		write('seed', 0);
		runtime.step();
		expect(frame()).toEqual(packFrame(expectedFrame(0, 0)));
		runtime.bytes[image.byteAddress + 1] = 0xa5;
		const cached = runtime.bytes.slice();
		runtime.step();
		runtime.step();
		expect(runtime.bytes).toEqual(cached);
		write('seed', 255);
		runtime.step();
		expect(frame()).toEqual(packFrame(expectedFrame(0, 255)));
		write('rule', 255);
		runtime.step();
		expect(frame()).toEqual(packFrame(expectedFrame(255, 255)));
		write('rule', 30);
		write('seed', 0x81);
		runtime.step();
		expect(frame()).toEqual(packFrame(expectedFrame(30, 0x81)));
	});
	it.each([-1, 256, -2147483648])('renders edited integer control defaults %i on the first frame', async value => {
		const runtime = await loadExample('visuals/elementaryCellularAutomata.8f4e', source =>
			source.replace('int rule 110', 'int rule ' + value).replace('int seed 1 ', 'int seed ' + value + ' ')
		);
		runtime.step();
		const image = runtime.modules.screen.memory.mono;
		const expected = packFrame(expectedFrame(value, value));
		expect(
			runtime.bytes
				.subarray(image.byteAddress, image.endByteAddress)
				.findIndex((byte, index) => byte !== expected[index])
		).toBe(-1);
	});
});
