import { ErrorCode, getProjectGroups, getProjectModules } from '@8f4e/language-spec';
import { promises as fs } from 'fs';
import { describe, expect, it } from 'vitest';
import { compileProject, parseProjectSource } from '../src';

async function readProject(relativePath: string) {
	return parseProjectSource(await fs.readFile(new URL(relativePath, import.meta.url), 'utf8'));
}

describe('group compiler metadata and cache', () => {
	it('preserves mixed declaration order per entry when reusing cached module ASTs', async () => {
		const project = parseProjectSource(`8f4e/v1
entry main
module rootA
moduleEnd
group synth
module voiceA
moduleEnd
module voiceB
moduleEnd
groupEnd
module rootB
moduleEnd
entryEnd
entry alternate
group other
module voiceA
moduleEnd
groupEnd
module alternateRoot
moduleEnd
entryEnd`);
		const first = await compileProject(project, { disableSharedMemory: true });
		const order = (result: typeof first) =>
			Object.values(result.compiledModules)
				.sort((a, b) => a.index - b.index)
				.map(module => [module.id, module.executionEntryName]);
		expect(order(first)).toEqual([
			['rootA', 'main'],
			['synth/voiceA', 'main'],
			['synth/voiceB', 'main'],
			['rootB', 'main'],
			['other/voiceA', 'alternate'],
			['alternateRoot', 'alternate'],
		]);
		const [rootA, synth, rootB, ...alternate] = project.execution;
		project.execution = [rootA!, rootB!, synth!, ...alternate];
		const second = await compileProject(project, { disableSharedMemory: true, cache: first.cache });
		expect(order(second)).toEqual([
			['rootA', 'main'],
			['rootB', 'main'],
			['synth/voiceA', 'main'],
			['synth/voiceB', 'main'],
			['other/voiceA', 'alternate'],
			['alternateRoot', 'alternate'],
		]);
		expect(second.cache.ast.stats.hits).toBeGreaterThan(0);
	});
	it('re-resolves scalar initializers and restores declaration defaults when removed', async () => {
		const project = await readProject('./groups/scalar-initializers.test.8f4e');
		const group = getProjectGroups(project)[0]!;
		const first = await compileProject(project, { disableSharedMemory: true });
		const previousHits = first.cache.ast.stats.hits;
		const initializerRow = group.code.findIndex(line => line.startsWith('init &foo '));
		group.code[initializerRow] = 'init &foo 22';

		const second = await compileProject(project, { disableSharedMemory: true, cache: first.cache });
		expect(second.cache.ast.stats.hits).toBeGreaterThan(previousHits);
		expect(first.memoryDefaultsByModuleId['values/processor']!.foo!.value).toBe(11);
		expect(second.memoryDefaultsByModuleId['values/processor']!.foo!.value).toBe(22);
		expect(getProjectModules(group)[0]!.code).toContain('int foo 3');

		group.code.splice(initializerRow, 1);
		const restored = await compileProject(project, { disableSharedMemory: true, cache: second.cache });
		expect(restored.memoryDefaultsByModuleId['values/processor']!.foo!.value).toBe(3);
	});

	it('re-resolves group initializers without changing cached declaration source', async () => {
		const project = await readProject('./groups/pointer-initializers.test.8f4e');
		const group = getProjectGroups(project)[0]!;
		const first = await compileProject(project, { disableSharedMemory: true });
		const previousHits = first.cache.ast.stats.hits;
		const initializerRow = group.code.findIndex(line => line.startsWith('init '));
		group.code[initializerRow] = 'init &input &source:alternate';

		const second = await compileProject(project, { disableSharedMemory: true, cache: first.cache });
		expect(second.cache.ast.stats.hits).toBeGreaterThan(previousHits);
		expect(second.memoryDefaultsByModuleId['synth/processor']!.input!.value).toBe(
			second.memoryPlan.modules.source!.memory.alternate!.byteAddress
		);
		expect(first.pointerMetadataByModuleId['synth/processor']!.input!.pointeeElementCount).toBe(3);
		expect(second.pointerMetadataByModuleId['synth/processor']!.input!.pointeeElementCount).toBe(2);
		expect(getProjectModules(group).find(module => module.code[0] === 'module processor')!.code).toContain(
			'int* input &fallback'
		);

		group.code.splice(initializerRow, 1);
		const restored = await compileProject(project, { disableSharedMemory: true, cache: second.cache });
		expect(restored.memoryDefaultsByModuleId['synth/processor']!.input!.value).toBe(
			restored.memoryPlan.modules['synth/processor']!.memory.fallback!.byteAddress
		);
		expect(restored.pointerMetadataByModuleId['synth/processor']!.input!.pointeeElementCount).toBe(2);
	});

	it('re-resolves passed namespaces when cached child ASTs are unchanged', async () => {
		const project = await readProject('./groups/constant-namespace-passes.test.8f4e');
		const first = await compileProject(project, { disableSharedMemory: true });
		const previousHits = first.cache.ast.stats.hits;
		project.constants[0]!.code = [
			'constants env',
			'const SAMPLE_RATE 96000',
			'const BLOCK_SIZE SAMPLE_RATE/1000',
			'constantsEnd',
		];

		const second = await compileProject(project, { disableSharedMemory: true, cache: first.cache });

		expect(second.cache.ast.stats.hits).toBeGreaterThan(previousHits);
		expect(second.memoryDefaultsByModuleId['audio/voice']!.rate!.value).toBe(96_000);
		expect(second.memoryDefaultsByModuleId['audio/nested/nestedVoice']!.blockSize!.value).toBe(96);
	});

	it('indexes recursively owned group blocks by their canonical paths', async () => {
		const project = await readProject('./groups/recursive-ordering.test.8f4e');
		expect(getProjectGroups(project)).toHaveLength(2);
		const group = getProjectGroups(project)[0]!;
		expect(group).toMatchObject({ name: 'synth', entry: 'test' });

		const result = await compileProject(project, { disableSharedMemory: true });
		const compiledModules = Object.values(result.compiledModules).sort((left, right) => left.index - right.index);
		expect(compiledModules.map(module => module.id)).toEqual([
			'rootA',
			'synth/voiceA',
			'synth/oscillator/tick',
			'synth/voiceB',
			'rootB',
			'tail/last',
			'rootC',
		]);
		expect(result.compiledModules['synth/voiceA']).toMatchObject({
			ast: { projectBlockId: getProjectModules(group)[0]!.id },
			executionEntryName: 'test',
		});
		expect(result.memoryPlan.modules['synth/voiceA']).toBeDefined();
		expect(result.memoryDefaultsByModuleId['synth/voiceA']).toBeDefined();
		expect(result.pointerMetadataByModuleId['synth/voiceA']).toBeDefined();
	});

	it('resolves exposure metadata to the backing declaration without allocating alias memory', async () => {
		const project = await readProject('./groups/memory-exposures.test.8f4e');
		const result = await compileProject(project, { disableSharedMemory: true });
		const exposure = result.projectMemoryExposuresByGroupPath['processing/audio'][0]!;
		const targetMemory = result.memoryPlan.modules['processing/audio/source']!.memory.value!;

		expect(exposure).toMatchObject({
			name: 'exposedValue',
			groupPath: 'processing/audio',
			targetModuleId: 'processing/audio/source',
			targetMemoryName: 'value',
		});
		expect(exposure.targetMemory).toBe(targetMemory);
		expect(result.memoryPlan.modules['processing/audio']).toBeUndefined();
	});

	it.each([
		{ fixture: 'missing-exposure-module', targetModuleId: 'audio/missing', targetMemoryId: 'value' },
		{ fixture: 'missing-exposure-memory', targetModuleId: 'audio/source', targetMemoryId: 'missing' },
	])('reports invalid unused group exposure targets without an AST line: $fixture', async testCase => {
		const project = await readProject(`./errors/groups/${testCase.fixture}.error.8f4e`);
		const compilation = compileProject(project, { disableSharedMemory: true });

		await expect(compilation).rejects.toMatchObject({
			code: ErrorCode.INVALID_PROJECT_MEMORY_EXPOSURE_TARGET,
			context: { projectGroupPath: 'audio', projectMemoryExposureName: 'publicValue' },
			message: expect.stringContaining(`${testCase.targetModuleId}:${testCase.targetMemoryId}`),
		});
		await expect(compilation).rejects.not.toHaveProperty('line');
	});
});
