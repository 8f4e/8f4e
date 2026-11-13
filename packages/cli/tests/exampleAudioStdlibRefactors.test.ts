import { createHash } from 'node:crypto';
import { describe, expect, test } from 'vitest';
import { loadExample, withProbe } from './exampleRuntime';

const modNames = [
	'aftertouch',
	'chiller',
	'chronodemon',
	'escapeFromSuicide',
	'hymn_to_aurora',
	'lowerIntentions',
	'movinShadows',
	'pneumatic',
];

describe('audio example regression coverage', () => {
	test.each([
		['audio/audioBuffer.8f4e', 'sine'],
		['audio/keyboardControlledMonoSynth.8f4e', 'sine'],
		['audio/risen.8f4e', 'sin'],
	])('%s preserves the sine transfer function and audio samples', async (path, sine) => {
		const runtime = await loadExample(path, source => withProbe(source, sine, ['float phase'], 'float'));
		const output = new Float32Array(4097);
		for (let i = 0; i < output.length; i++) {
			output[i] = runtime.call(
				'probe' + sine[0].toUpperCase() + sine.slice(1),
				Math.fround(-Math.PI + (2 * Math.PI * i) / 4096)
			);
		}
		expect(createHash('sha256').update(new Uint8Array(output.buffer)).digest('hex')).toMatchSnapshot('sine samples');
		const audio = createHash('sha256');
		if (runtime.modules.keyboard) {
			const keys = runtime.modules.keyboard.memory;
			runtime.view.setInt32(keys.keyCode.byteAddress, 4, true);
			runtime.view.setInt32(keys.keyPressed.byteAddress, 1, true);
		}
		for (let block = 0; block < 16; block++) {
			runtime.call('buffer');
			for (const id of ['audioout', 'audiooutL', 'audiooutR', 'shofar']) {
				const buffer = runtime.modules[id]?.memory.buffer;
				if (buffer) audio.update(runtime.bytes.subarray(buffer.byteAddress, buffer.endByteAddress));
			}
		}
		expect(audio.digest('hex')).toMatchSnapshot('audio blocks');
	});

	test.each(modNames)('%s decodes packed rows and copies all four row windows', async name => {
		const runtime = await loadExample('audio/amigaMods/' + name + '.8f4e', source => {
			for (const fn of ['maskEffect', 'maskParam', 'maskPeriod', 'maskSampleNumber'])
				source = withProbe(source, fn, ['int row'], 'int');
			const rows = [...source.matchAll(/^module rowBuffer[1-4]\n[\s\S]*?^moduleEnd/gm)];
			expect(rows).toHaveLength(4);
			return (
				source +
				'\nentry rowProbe\n' +
				rows.map((row, index) => row[0].replace(/^module rowBuffer[1-4]/, 'module observed' + index)).join('\n') +
				'\nentryEnd\n'
			);
		});
		let random = 0x12345678;
		for (let i = 0; i < 4096; i++) {
			random ^= random << 13;
			random ^= random >>> 17;
			random ^= random << 5;
			const word = random | 0;
			expect(runtime.call('probeMaskEffect', word)).toBe((word >>> 16) & 15);
			// Preserve the older Hymn player's signed effect-parameter byte.
			expect(runtime.call('probeMaskParam', word)).toBe(name === 'hymn_to_aurora' ? word >> 24 : word >>> 24);
			expect(runtime.call('probeMaskPeriod', word)).toBe(((word & 15) << 8) | ((word >>> 8) & 255));
			expect(runtime.call('probeMaskSampleNumber', word)).toBe((word & 0xf0) | ((word >>> 20) & 15));
		}
		const probes = Array.from({ length: 4 }, (_, index) => runtime.modules['observed' + index]);
		for (const probe of probes) {
			const data = probe.memory._dat;
			for (let i = 0; i < data.numberOfElements; i++)
				runtime.view.setInt32(data.byteAddress + i * 4, Math.imul(i + 1, 0x1234567), true);
		}
		for (const chooseStart of [(length: number) => 0, (length: number) => 8, (length: number) => length - 8]) {
			for (const probe of probes) {
				const data = probe.memory._dat;
				runtime.view.setInt32(
					runtime.view.getInt32(probe.memory.row.byteAddress, true),
					chooseStart(data.numberOfElements),
					true
				);
			}
			const expected = runtime.bytes.slice();
			for (const probe of probes) {
				const data = probe.memory._dat;
				const start = chooseStart(data.numberOfElements);
				expected.set(
					runtime.bytes.subarray(data.byteAddress + start * 4, data.byteAddress + (start + 8) * 4),
					probe.byteAddress
				);
			}
			runtime.call('rowProbe');
			expect(runtime.bytes.findIndex((byte, i) => byte !== expected[i])).toBe(-1);
		}
	});

	test('Grids reads byte channels and retains its integer crossfade rounding', async () => {
		const runtime = await loadExample(
			'audio/gridsPatterns.8f4e',
			source =>
				withProbe(
					withProbe(source, 'readPattern', ['int* row', 'int shift'], 'int', true),
					'mixByte',
					['int first', 'int second', 'int amount'],
					'int'
				),
			0,
			'readPattern'
		);
		const address = 64;
		for (const shift of [0, 8, 16, 24])
			for (let byte = 0; byte < 256; byte++) {
				const word = (0x89765432 & ~(255 << shift)) | (byte << shift);
				runtime.view.setInt32(address, word, true);
				expect(runtime.call('probeReadPattern', address, shift)).toBe(byte);
			}
		for (const first of [0, 1, 128, 254, 255])
			for (const second of [0, 1, 128, 254, 255])
				for (let amount = 0; amount < 256; amount++) {
					expect(runtime.call('probeMixByte', first, second, amount)).toBe(
						(first * (255 - amount) + second * amount) >>> 8
					);
				}
	});
});
