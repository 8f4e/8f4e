import { readFile } from 'node:fs/promises';
import { compileProject, parseProjectSource } from '@8f4e/compiler';
import { describe, expect, it } from 'vitest';
import { resolveStdlibInclude } from '../src/shared/stdlibResolver';

describe('Grids output reset', () => {
	it('clears one-sample triggers while preserving density controls', async () => {
		const source = await readFile(
			new URL('../../examples/src/projects/audio/gridsPatterns.8f4e', import.meta.url),
			'utf8'
		);
		const result = await compileProject(parseProjectSource(source), { resolveInclude: resolveStdlibInclude });
		const pages = Math.max(1, Math.ceil(result.requiredMemoryBytes / 65536));
		const memory = new WebAssembly.Memory({ initial: pages, maximum: pages, shared: true });
		const { instance } = await WebAssembly.instantiate(new Uint8Array(result.codeBuffer), { host: { memory } });
		(instance.exports.initDefaults as () => void)();
		const view = new DataView(memory.buffer);
		const output = result.memoryPlan.modules['grids/outputs'].memory;
		const gates = ['bd', 'sd', 'hh', 'accentBD', 'accentSD', 'accentHH'];
		const densities = ['densityBD', 'densitySD', 'densityHH'];
		const read = (field: string) => view.getInt32(output[field].byteAddress, true);
		const write = (field: string, value: number) => view.setInt32(output[field].byteAddress, value, true);
		const main = instance.exports.main as () => void;
		densities.forEach((field, index) => write(field, [37, 129, 255][index]));
		gates.forEach(field => write(field, -1));
		main();
		expect(gates.map(read)).toEqual([0, 0, 0, 0, 0, 0]);
		expect(densities.map(read)).toEqual([37, 129, 255]);

		densities.forEach(field => write(field, 255));
		view.setInt32(result.memoryPlan.modules.clock.memory.phase.byteAddress, 48000 * 60, true);
		main();
		expect(gates.map(read).some(value => value !== 0)).toBe(true);
		main();
		expect(gates.map(read)).toEqual([0, 0, 0, 0, 0, 0]);
		expect(densities.map(read)).toEqual([255, 255, 255]);
	});
});
