import { compileProject } from '@8f4e/cli';
import { parseProjectSource } from '@8f4e/compiler';
import { getProjectModules } from '@8f4e/language-spec';
import path from 'path';
import { fileURLToPath } from 'url';

import { describe, expect, it } from 'vitest';
import { readExampleProject } from './programSources';

const testDir = path.dirname(fileURLToPath(import.meta.url));
const exampleProjects = [
	'audio/audioBuffer.8f4e',
	'audio/keyboardControlledMonoSynth.8f4e',
	'digital/bistableMultivibrators.8f4e',
	'machine-learning/xorProblem.8f4e',
] as const;

function getSnapshotPath(relativePath: string): string {
	const fileName = relativePath.replace(/\.8f4e$/, '.snap');
	return path.join(testDir, '__snapshots__', 'exampleProjectsLayout', fileName);
}

async function loadExampleProject(relativePath: string) {
	const raw = await readExampleProject(relativePath);
	return parseProjectSource(raw);
}

function getProjectModuleBlocks(project: Awaited<ReturnType<typeof loadExampleProject>>) {
	return [...getProjectModules(project), ...project.constants];
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

		const result = await compileProject(project);

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
