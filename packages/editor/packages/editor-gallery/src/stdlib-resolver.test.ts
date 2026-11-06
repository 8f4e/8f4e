import { compileProject, parseProjectSource } from '@8f4e/compiler';
import { describe, expect, it } from 'vitest';
import { resolveStdlibInclude } from './stdlib-resolver';

describe('resolveStdlibInclude', () => {
	it.each([
		{ id: 'std/math/fract', fn: 'fract', input: '3.25', expected: 0.25 },
		{ id: 'std/math/exp2', fn: 'exp2', input: '-1.0', expected: 0.5 },
	])('compiles and executes the discovered $id include', async ({ id, fn, input, expected }) => {
		const project = parseProjectSource(
			[
				'8f4e/v1',
				'includes',
				`include ${id}`,
				'includesEnd',
				'entry main',
				'module consumer',
				'float result',
				'push &result',
				`push ${input}`,
				`call ${fn}`,
				'store',
				'moduleEnd',
				'entryEnd',
			].join('\n')
		);
		const result = await compileProject(project, {
			disableSharedMemory: true,
			resolveInclude: resolveStdlibInclude,
		});
		const memory = new WebAssembly.Memory({ initial: 1, maximum: 1 });
		const { instance } = await WebAssembly.instantiate(result.codeBuffer, { host: { memory } });

		(instance.exports.main as () => void)();

		const resultAddress = result.memoryPlan.modules.consumer!.memory.result!.byteAddress;
		expect(new DataView(memory.buffer).getFloat32(resultAddress, true)).toBe(expected);
	});

	it.each(['std/unknown', 'toString', '__proto__'])('returns undefined for unknown include %s', async id => {
		expect(await resolveStdlibInclude(id)).toBeUndefined();
	});
});
