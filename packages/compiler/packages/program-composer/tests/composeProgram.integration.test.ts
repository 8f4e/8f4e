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
		moduleEntryNames: program.moduleEntryNames,
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

	it.each(fixtureNames)('matches the composed program snapshot for %s', async fixtureName => {
		await expect(createCompositionSnapshot(fixtureName)).toMatchFileSnapshot(
			path.join(snapshotDirectory, `${fixtureName}.program.snap`)
		);
	});
});
