import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { expect, test } from 'vitest';
import { collectionRoot } from './programSources';

const execFileAsync = promisify(execFile);

test('runs embedded assertions in example modules through the CLI', async () => {
	const cli = fileURLToPath(import.meta.resolve('@8f4e/cli/cli'));
	const { stdout } = await execFileAsync(process.execPath, [cli, 'test', '**/*.8f4em'], {
		cwd: collectionRoot('modules'),
	});
	expect(stdout).toMatch(/^(No tests found\.|Ran \d+ assertions?(?: in \d+ files?)?\.)\n$/);
});
