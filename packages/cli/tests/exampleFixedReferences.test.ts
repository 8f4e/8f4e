import { glob, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { compileProject, parseProjectSource } from '@8f4e/compiler';
import { describe, expect, it } from 'vitest';
import { resolveStdlibInclude } from '../src/shared/stdlibResolver';

const examplesRoot = new URL('../../examples/src/', import.meta.url);
const projects: Array<{ file: string; source: string }> = [];
for await (const file of glob('**/*.{8f4e,8f4em}', { cwd: fileURLToPath(examplesRoot) })) {
	const source = await readFile(new URL(file, examplesRoot), 'utf8');
	if (/^(?:int(?:8u?|16u?)?|float(?:64)?)&\s/m.test(source)) projects.push({ file, source });
}
projects.sort((a, b) => a.file.localeCompare(b.file));

describe('example fixed references', () => {
	it.each(projects)('compiles fixed bindings in $file', async ({ file, source }) => {
		if (file.endsWith('resonantLowPassFilter.8f4em')) {
			// This reusable filter expects an input module from its containing project.
			source += '\nentry main\nmodule phaseAccumulator\nfloat out\nmoduleEnd\nentryEnd';
		}
		if (file.endsWith('granularSampler.8f4e')) {
			// Its existing delay sizes require an integral sample-rate ratio.
			source = source.replace('const SAMPLE_RATE 48000', 'const SAMPLE_RATE 32000');
		}
		const result = await compileProject(parseProjectSource(source), {
			disableSharedMemory: true,
			resolveInclude: resolveStdlibInclude,
		});
		expect(Object.values(result.compiledModules).some(module => Object.keys(module.referenceSlots).length > 0)).toBe(
			true
		);
		await WebAssembly.compile(new Uint8Array(result.codeBuffer));
	});
});
