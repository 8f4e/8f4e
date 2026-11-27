import { glob } from 'node:fs/promises';
import { sep } from 'node:path';
import { compileProject, parseProjectSource } from '@8f4e/compiler';
import { describe, expect, it } from 'vitest';
import { collectionRoot, type ProgramSourceId, readProgramSource, resolveStdlibInclude } from './programSources';

const projects: Array<{ file: ProgramSourceId; source: string }> = [];
for (const collection of ['projects', 'modules', 'benchmarks'] as const) {
	for await (const path of glob('**/*.{8f4e,8f4em}', { cwd: collectionRoot(collection) })) {
		const file: ProgramSourceId = `${collection}/${path.split(sep).join('/')}`;
		const source = await readProgramSource(file);
		if (/^(?:int(?:8u?|16u?)?|float(?:64)?)&\s/m.test(source)) projects.push({ file, source });
	}
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
			resolveInclude: resolveStdlibInclude,
		});
		expect(Object.values(result.compiledModules).some(module => Object.keys(module.referenceSlots).length > 0)).toBe(
			true
		);
		await WebAssembly.compile(new Uint8Array(result.codeBuffer));
	});
});
