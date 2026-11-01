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

function getSnapshotPath(relativePath: string): string {
	const fileName = relativePath.replace(/[/.]/g, '_') + '.snap';
	return path.join(testDir, '__snapshots__', 'exampleProjectsLayout', fileName);
}

async function loadExampleProject(relativePath: string) {
	const raw = await fs.readFile(path.join(repoRoot, relativePath), 'utf8');
	return parseProjectSource(raw);
}

function getProjectModuleBlocks(project: Awaited<ReturnType<typeof loadExampleProject>>) {
	return [...project.modules, ...project.constants];
}

function getBlockId(block: { code: string[] }): string {
	const firstLine = block.code[0]?.trim() ?? '';
	const [, id = ''] = firstLine.split(/\s+/, 2);
	return id || 'constants';
}

describe('compileProject (example project layout)', () => {
	it.each(exampleProjects)('captures layout invariants for %s', async relativePath => {
		const project = await loadExampleProject(relativePath);
		const moduleBlocks = getProjectModuleBlocks(project);

		const cliModule = await import(pathToFileURL(path.join(packageRoot, 'dist', 'index.js')).href);
		const result = await cliModule.compileProject(project);

		const compiledModuleLayout = Object.values(result.compiledModules)
			.sort((a, b) => a.index - b.index)
			.map(module => ({
				id: module.id,
				index: module.index,
				byteAddress: result.memoryPlan.modules[module.id].byteAddress,
				allocationUnitAddress: result.memoryPlan.modules[module.id].byteAddress / 4,
				allocationUnitCount: result.memoryPlan.modules[module.id].allocationUnitCount,
				skipExecutionInCycle: module.skipExecutionInCycle ?? false,
			}));

		const snapshotPayload = {
			sourceModuleOrder: moduleBlocks.map(getBlockId),
			compiledModuleLayout,
		};

		await expect(JSON.stringify(snapshotPayload, null, 2)).toMatchFileSnapshot(getSnapshotPath(relativePath));
	});
});
