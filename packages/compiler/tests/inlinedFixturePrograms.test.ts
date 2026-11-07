import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { collectFixtureProgramFiles, runFixtureProgramFile, testRoot } from './testUtils';

const files = await collectFixtureProgramFiles();

describe('fixture programs with function inlining', () => {
	it.each(files.map(file => [path.relative(testRoot, file), file]))('%s', async (_name, file) => {
		const { assertions } = await runFixtureProgramFile(file, { inlineFunctions: true });
		expect(assertions.length).toBeGreaterThan(0);
	});
});
