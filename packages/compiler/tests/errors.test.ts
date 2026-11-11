import { serializeDiagnostic } from '@8f4e/compiler-diagnostics';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { describe, expect, test } from 'vitest';
import { compileProject, parseProjectSource } from '../src';
import { resolveTestInclude } from './testIncludeResolver';

const errorRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), 'errors');

async function collectErrorFiles(directory: string): Promise<string[]> {
	const entries = await fs.readdir(directory, { withFileTypes: true });
	const nestedFiles = await Promise.all(
		entries.map(entry => {
			const entryPath = path.join(directory, entry.name);

			if (entry.isDirectory()) {
				return collectErrorFiles(entryPath);
			}
			if (entry.isFile() && entry.name.endsWith('.error.8f4e')) {
				return [entryPath];
			}

			return [];
		})
	);

	return nestedFiles.flat().sort();
}

async function compileErrorFixture(filePath: string) {
	const source = await fs.readFile(filePath, 'utf8');
	return compileProject(parseProjectSource(source), {
		resolveInclude: resolveTestInclude,
	});
}

function getErrorSnapshotPath(filePath: string): string {
	const relativePath = path.relative(errorRoot, filePath);

	return path.join(errorRoot, '__snapshots__', `${relativePath}.diagnostic.snap`);
}

const errorFiles = await collectErrorFiles(errorRoot);

describe('8f4e compiler error fixtures', () => {
	test('has fixtures', () => {
		expect(errorFiles.length).toBeGreaterThan(0);
	});

	test.each(errorFiles.map(filePath => [path.relative(errorRoot, filePath), filePath]))(
		'%s',
		async (_name, filePath) => {
			let thrownError: unknown;

			try {
				await compileErrorFixture(filePath);
			} catch (error) {
				thrownError = error;
			}

			expect(thrownError).toBeDefined();
			const snapshotPath = getErrorSnapshotPath(filePath);

			await fs.mkdir(path.dirname(snapshotPath), { recursive: true });
			const diagnostic = serializeDiagnostic(thrownError, 'compile');
			expect(diagnostic.kind).toBe('source');
			if (diagnostic.kind === 'source') {
				expect(diagnostic.location.kind).toBeDefined();
				expect(diagnostic.location.lineNumber).toBeGreaterThanOrEqual(0);
			}
			await expect(diagnostic).toMatchFileSnapshot(snapshotPath);
		}
	);
});
