import { createHash } from 'node:crypto';
import { describe, expect, test } from 'vitest';
import { loadExample } from './exampleRuntime';

describe('digit classifier behavior', () => {
	test('preserves every neuron for all 32768 binary input grids', async () => {
		const runtime = await loadExample('machine-learning/digitClassifier.8f4e');
		const neurons = Object.keys(runtime.modules)
			.filter(name => /^neuron[0-9]+$/.test(name))
			.sort((a, b) => Number(a.slice(6)) - Number(b.slice(6)));
		expect(neurons).toHaveLength(103);
		const values = new Uint32Array(32768 * neurons.length);
		let index = 0;
		for (let grid = 0; grid < 32768; grid++) {
			for (let row = 0; row < 5; row++)
				runtime.view.setInt32(runtime.modules.grid.memory['row' + row].byteAddress, (grid >>> (row * 3)) & 7, true);
			runtime.step();
			for (const neuron of neurons)
				values[index++] = runtime.view.getUint32(runtime.modules[neuron].memory.out.byteAddress, true);
		}
		expect(createHash('sha256').update(new Uint8Array(values.buffer)).digest('hex')).toMatchSnapshot(
			'all neuron outputs'
		);
	});
});
