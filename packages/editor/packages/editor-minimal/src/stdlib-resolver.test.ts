import { compileProject, parseProjectSource } from '@8f4e/compiler';
import { describe, expect, it } from 'vitest';
import { resolveStdlibInclude } from './stdlib-resolver';

describe('resolveStdlibInclude', () => {
	it('compiles and executes a project using a real standard-library include', async () => {
		const project = parseProjectSource(
			[
				'8f4e/v1',
				'includes',
				'include std/math/fract',
				'includesEnd',
				'entry main',
				'module consumer',
				'float result',
				'push &result',
				'push 3.25',
				'call fract',
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
		expect(new DataView(memory.buffer).getFloat32(resultAddress, true)).toBe(0.25);
	});

	it.each(['std/unknown', 'toString', '__proto__'])('returns undefined for unknown include %s', async id => {
		expect(await resolveStdlibInclude(id)).toBeUndefined();
	});
});
