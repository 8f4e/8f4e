import { parseProjectSource } from '@8f4e/compiler';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

import { describe, expect, it } from 'vitest';

const testDir = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(testDir, '..');
const repoRoot = path.resolve(packageRoot, '..', '..');

const exampleProjects = [
	'packages/examples/src/projects/audio/audioBuffer.8f4e',
	'packages/examples/src/projects/audio/keyboardControlledMonoSynth.8f4e',
	'packages/examples/src/projects/digital/bistableMultivibrators.8f4e',
	'packages/examples/src/projects/machine-learning/xorProblem.8f4e',
] as const;

const reverbProjects = [
	'packages/examples/src/projects/audio/reverb.8f4e',
	'packages/examples/src/projects/audio/reverbGrouped.8f4e',
	'packages/examples/src/projects/audio/reverbTweakable.8f4e',
] as const;

function getSnapshotPath(relativePath: string): string {
	const fileName = relativePath.replace(/[/.]/g, '_') + '.snap';
	return path.join(testDir, '__snapshots__', 'exampleProjectsCompilation', fileName);
}

async function loadExampleProject(relativePath: string) {
	const raw = await fs.readFile(path.join(repoRoot, relativePath), 'utf8');
	return parseProjectSource(raw);
}

describe('compileProject (example projects)', () => {
	it.each(exampleProjects)('compiles %s consistently', async relativePath => {
		const project = await loadExampleProject(relativePath);
		const cliModule = await import(pathToFileURL(path.join(packageRoot, 'dist', 'index.js')).href);
		const result = await cliModule.compileProject(project);

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

	it.each(reverbProjects)('compiles %s', async relativePath => {
		const project = await loadExampleProject(relativePath);
		const cliModule = await import(pathToFileURL(path.join(packageRoot, 'dist', 'index.js')).href);
		const result = await cliModule.compileProject(project);

		expect(result.compiledWasm.length).toBeGreaterThan(0);
	});
});
