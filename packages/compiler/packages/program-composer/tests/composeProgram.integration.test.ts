import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseProjectSource } from '@8f4e/project-preparser';
import { describe, expect, it } from 'vitest';
import { composeProgram, createCompilerCache } from '../src';

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
const fixtureDirectory = path.join(currentDirectory, 'fixtures');
const snapshotDirectory = path.join(currentDirectory, '__snapshots__');

function readFixtureNames(): string[] {
	return readdirSync(fixtureDirectory, { withFileTypes: true })
		.filter(entry => entry.isFile() && entry.name.endsWith('.8f4e'))
		.map(entry => entry.name)
		.sort();
}

function createCompositionSnapshot(fixtureName: string) {
	const source = readFileSync(path.join(fixtureDirectory, fixtureName), 'utf8');
	const project = parseProjectSource(source);
	const cache = createCompilerCache();
	composeProgram(project, cache);
	const program = composeProgram(project, cache);

	return {
		entries: program.entries,
		...(program.projectConstantNamespaceScopes.length > 0
			? { projectConstantNamespaceScopes: program.projectConstantNamespaceScopes }
			: {}),
		memoryExposures: program.memoryExposures,
		...(program.memoryAliases.size > 0
			? {
					memoryAliases: Object.fromEntries(
						[...program.memoryAliases].map(([groupPath, aliases]) => [groupPath, Object.fromEntries(aliases)])
					),
				}
			: {}),
		ast: program.ast,
		cache: {
			keys: [...cache.ast.entries.keys()].sort(),
			stats: cache.ast.stats,
		},
	};
}

describe('composeProgram fixtures', () => {
	const fixtureNames = readFixtureNames();

	it('has project fixtures', () => {
		expect(fixtureNames.length).toBeGreaterThan(0);
	});

	it('binds exposure declarations to their owning scope while preserving stored rows', () => {
		const project = parseProjectSource(`8f4e/v1
entry main
group outer
entry main
group inner
; keep this row
expose value &source:value
groupEnd
entryEnd
groupEnd
entryEnd`);
		expect(composeProgram(project).memoryExposures).toEqual([
			{
				name: 'value',
				targetModuleName: 'source',
				targetMemoryName: 'value',
				lineNumber: 2,
				groupPath: 'outer/inner',
				targetModuleId: 'outer/inner/source',
				diagnosticSource: { kind: 'scope', projectGroupPath: 'outer/inner' },
				instruction: 'expose',
			},
		]);
	});

	it('recomputes function passes without changing cached source calls', () => {
		const source = readFileSync(path.join(fixtureDirectory, 'function-passes.8f4e'), 'utf8');
		const project = parseProjectSource(source);
		const cache = createCompilerCache();
		const shared = composeProgram(project, cache);
		const callTarget = (program: ReturnType<typeof composeProgram>) =>
			program.ast.modules.find(ast => ast.id === 'voice/output')!.lines.find(line => line.instruction === 'call')!
				.arguments[0].value;
		expect(callTarget(shared)).toBe('double');
		const voice = project.execution.find(block => block.type === 'group')!;
		voice.code = voice.code.filter(line => line.trim() !== 'pass double');
		expect(callTarget(composeProgram(project, cache))).toBe('voice/double');
		expect(callTarget(shared)).toBe('double');
	});

	it.each(fixtureNames)('matches the composed program snapshot for %s', async fixtureName => {
		await expect(createCompositionSnapshot(fixtureName)).toMatchFileSnapshot(
			path.join(snapshotDirectory, `${fixtureName}.program.snap`)
		);
	});
});
