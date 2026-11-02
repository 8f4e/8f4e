import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { getUnsupportedSettings, toConstantsBlock } from '../src/convert.ts';
import { decodeDx7 } from '../src/decode.ts';
import { bank, dump, singleVoice } from './fixtures.ts';

describe('DX7 conversion', () => {
	it('unpacks operator order, bit fields, transpose, and LFO parameters', () => {
		const patches = decodeDx7(bank());
		expect(patches).toHaveLength(32);
		const patch = patches[0];
		expect(patch).toMatchObject({
			name: 'Alpha',
			algorithm: 5,
			feedback: 5,
			keySync: 1,
			transpose: -12,
			pitchRates: [99, 98, 97, 96],
			pitchLevels: [50, 50, 50, 50],
			lfoSpeed: 25,
			lfoDelay: 40,
			lfoPitchDepth: 20,
			lfoAmplitudeDepth: 30,
			lfoSync: 1,
			lfoWave: 5,
			pitchModSensitivity: 5,
		});
		expect(patch.operators[0]).toEqual({
			rates: [99, 60, 40, 70],
			levels: [99, 88, 77, 0],
			breakpoint: 39,
			leftDepth: 12,
			rightDepth: 23,
			leftCurve: 2,
			rightCurve: 1,
			rateScaling: 3,
			detune: 11,
			ampModSensitivity: 1,
			velocitySensitivity: 6,
			outputLevel: 83,
			mode: 0,
			coarse: 3,
			fine: 25,
		});
		expect(patch.operators[4]).toMatchObject({ mode: 1, coarse: 0, fine: 30, detune: 6 });
		expect(patch.operators[5]).toMatchObject({ coarse: 1, fine: 0, detune: 7 });
		expect(patches[1].algorithm).toBe(32);
	});

	it('decodes equivalent single-voice and bank dumps identically on any device channel', () => {
		const single = dump(singleVoice(), 0);
		single[2] = 15;
		expect(decodeDx7(single)[0]).toEqual(decodeDx7(bank())[0]);
		expect(decodeDx7(new Uint8Array([...single, ...bank()]))).toHaveLength(33);
	});

	it.each(['empty', 'manufacturer', 'channel', 'format', 'length', 'truncated', 'end', 'checksum', 'data'])(
		'rejects %s corruption',
		kind => {
			let bytes = bank();
			if (kind === 'empty') bytes = new Uint8Array();
			if (kind === 'manufacturer') bytes[1] = 0x41;
			if (kind === 'channel') bytes[2] = 0x10;
			if (kind === 'format') bytes[3] = 7;
			if (kind === 'length') bytes[5] = 1;
			if (kind === 'truncated') bytes = bytes.subarray(0, -1);
			if (kind === 'end') bytes[bytes.length - 1] = 0;
			if (kind === 'checksum') bytes[bytes.length - 2] ^= 1;
			if (kind === 'data') bytes[6] = 128;
			expect(() => decodeDx7(bytes)).toThrow();
		}
	);

	it('emits raw parameters and derived tuning with transpose applied only to ratios', () => {
		const patch = decodeDx7(bank())[0];
		const text = toConstantsBlock(patch, { x: 20, y: -10, source: 'Synthetic fixture' });
		expect(text).toContain('constants preset\n; @pos 20 -10\n; Alpha\n; @hide');
		expect(text).toContain('const TRANSPOSE_SEMITONES -12');
		expect(text).toContain('const OP1_COARSE 3');
		expect(text).toContain('const OP1_LEFT_CURVE 2');
		expect(text).toContain('const OP1_VELOCITY_SENSITIVITY 6');
		expect(text).toContain('const OP1_GAIN 0.83');
		const ratio = Number(text.match(/const OP1_RATIO (.+)/)![1]);
		expect(ratio).toBeCloseTo(1.878910178, 7);
		expect(text).toContain('const OP5_RATIO 0.000000000');
		expect(text).toContain('const OP5_FIXED_HZ 1.995262315');
		expect(text).toContain('const OUTPUT_GAIN 0.65');
		expect(text.endsWith('constantsEnd\n')).toBe(true);
		expect(getUnsupportedSettings(patch)).toEqual([]);
		expect(text).not.toContain('Preserved settings not applied');
		patch.pitchLevels[0] = 60;
		patch.algorithm = 3;
		expect(getUnsupportedSettings(patch)).toEqual(['algorithm 3 routing']);
		expect(getUnsupportedSettings(patch)).toContain('algorithm 3 routing');
		expect(toConstantsBlock(patch)).not.toContain('const MIX1_GAIN');
	});

	it('keeps control characters in a patch name inside the generated comment', () => {
		const patch = decodeDx7(bank())[0];
		patch.name = 'a\nmodule x';
		expect(toConstantsBlock(patch)).toContain('; a?module x\n');
	});

	it('selects exact names and algorithms, lays out blocks, and writes through the CLI', async () => {
		const directory = await mkdtemp(join(tmpdir(), 'dx7-to-8f4e-'));
		try {
			const input = join(directory, 'bank.syx');
			const output = join(directory, 'blocks.8f4e');
			await writeFile(input, bank());
			const cli = fileURLToPath(new URL('../src/cli.ts', import.meta.url));
			const converted = spawnSync(
				process.execPath,
				[
					cli,
					input,
					'--name',
					'alpha',
					'--name',
					'Alpha 3',
					'--algorithm',
					'5',
					'--x',
					'348',
					'--y',
					'35',
					'--step-x',
					'0',
					'--step-y',
					'7',
					'--out',
					output,
				],
				{ encoding: 'utf8' }
			);
			expect(converted.status, converted.stderr).toBe(0);
			expect(converted.stdout).toBe('');
			expect(converted.stderr).toBe('');
			const text = await readFile(output, 'utf8');
			expect(text.match(/constants preset/g)).toHaveLength(2);
			expect(text).toContain('; @pos 348 35\n; Alpha\n');
			expect(text).toContain('; @pos 348 42\n; Alpha 3\n');
			expect(text).not.toContain('; Alpha 2\n');
			expect(
				execFileSync(process.execPath, [cli, input, '--algorithm', '32'], {
					encoding: 'utf8',
					stdio: ['ignore', 'pipe', 'ignore'],
				})
			).toContain('const ALGORITHM 32');
			for (const args of [
				['--name', 'Missing'],
				['--algorithm', '0'],
				['--x', '1.5'],
				['--algorithm', '6'],
			]) {
				await writeFile(output, 'keep existing output');
				const invalid = spawnSync(process.execPath, [cli, input, ...args, '--out', output], { encoding: 'utf8' });
				expect(invalid.status).toBe(1);
				expect(await readFile(output, 'utf8')).toBe('keep existing output');
			}
		} finally {
			await rm(directory, { recursive: true, force: true });
		}
	});
});
