import { compileProject } from '@8f4e/cli';
import { parseProjectSource } from '@8f4e/compiler';
import path from 'path';
import { fileURLToPath } from 'url';

import { describe, expect, it } from 'vitest';
import { type ProgramSourceId, readExampleProject, readProgramSource } from './programSources';

const testDir = path.dirname(fileURLToPath(import.meta.url));
const exampleProjects = [
	'audio/audioBuffer.8f4e',
	'audio/keyboardControlledMonoSynth.8f4e',
	'digital/bistableMultivibrators.8f4e',
	'machine-learning/xorProblem.8f4e',
] as const;

const additionalProjects = [
	'projects/audio/formantSynth.8f4e',
	'projects/audio/keyboardController6OperatorFMSynth.8f4e',
	'projects/audio/minBLEP.8f4e',
	'benchmarks/fmSynth.8f4e',
	'benchmarks/minBLEP.8f4e',
	'projects/audio/reverb.8f4e',
	'projects/midi/dx7Algorithm5EightVoices.8f4e',
	'projects/audio/gridsPatterns.8f4e',
] satisfies ProgramSourceId[];

function getSnapshotPath(relativePath: string): string {
	const fileName = relativePath.replace(/\.8f4e$/, '.snap');
	return path.join(testDir, '__snapshots__', 'exampleProjectsCompilation', fileName);
}

describe('compileProject (example projects)', () => {
	it.each(exampleProjects)('compiles %s consistently', async relativePath => {
		const project = parseProjectSource(await readExampleProject(relativePath));
		const result = await compileProject(project);

		const snapshotPayload = {
			compilerOptions: result.compilerOptions,
			compiledModules: result.compiledModules,
			memoryPlan: result.memoryPlan,
			memoryDefaultsByModuleId: result.memoryDefaultsByModuleId,
			pointerMetadataByModuleId: result.pointerMetadataByModuleId,
			compiledWasm: result.compiledWasm,
			requiredMemoryBytes: result.requiredMemoryBytes,
		};

		await expect(JSON.stringify(snapshotPayload, null, 2)).toMatchFileSnapshot(getSnapshotPath(relativePath));
	});

	it.each(additionalProjects)('compiles %s', async sourceId => {
		const project = parseProjectSource(await readProgramSource(sourceId));
		const result = await compileProject(project);

		expect(result.compiledWasm.length).toBeGreaterThan(0);
	});
});
