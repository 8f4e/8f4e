import { promises as fs } from 'fs';
import path from 'path';

import { describe, expect, test } from 'vitest';

import { collectFixtureProgramFiles, getCompileSnapshotPath, runFixtureProgramFile, testRoot } from './testUtils';

const testFiles = await collectFixtureProgramFiles(testRoot);

describe('8f4e fixture programs', () => {
	test('has fixtures', () => {
		expect(testFiles.length).toBeGreaterThan(0);
	});

	test.each(testFiles.map(filePath => [path.relative(testRoot, filePath), filePath]))('%s', async (_name, filePath) => {
		const { assertions, compileSnapshots } = await runFixtureProgramFile(filePath);
		const snapshotPath = getCompileSnapshotPath(filePath);

		expect(assertions.length).toBeGreaterThan(0);
		await fs.mkdir(path.dirname(snapshotPath), { recursive: true });
		await expect(compileSnapshots).toMatchFileSnapshot(snapshotPath);
	});
});
