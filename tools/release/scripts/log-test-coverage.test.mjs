import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const script = fileURLToPath(new URL('./log-test-coverage.mjs', import.meta.url));

async function writeJson(file, value) {
	await fs.mkdir(path.dirname(file), { recursive: true });
	await fs.writeFile(file, JSON.stringify(value));
}

function summary(covered, total) {
	const metric = { covered, total, pct: (covered / total) * 100 };
	return { total: { lines: metric, branches: metric, statements: metric, functions: metric } };
}

test('requires current package-local reports before appending any coverage history', async t => {
	const root = await fs.mkdtemp(path.join(os.tmpdir(), '8f4e-test-coverage-'));
	t.after(() => fs.rm(root, { recursive: true, force: true }));
	await writeJson(path.join(root, 'nx.json'), { targetDefaults: { test: { outputs: ['{projectRoot}/coverage'] } } });
	await writeJson(path.join(root, 'package.json'), { name: 'workspace', private: true, workspaces: ['packages/*'] });
	const testTarget = { executor: 'nx:run-commands', options: { command: 'vitest run' } };
	for (const [name, targets] of [
		['a', { test: testTarget }],
		['b', { test: testTarget }],
		['integration', { test: { ...testTarget, outputs: [] } }],
		['assets', {}],
	]) {
		const projectRoot = path.join(root, 'packages', name);
		await writeJson(path.join(projectRoot, 'package.json'), { name: `@example/${name}`, version: '1.0.0' });
		await writeJson(path.join(projectRoot, 'project.json'), { name: `@example/${name}`, targets });
		await fs.mkdir(path.join(projectRoot, 'src'), { recursive: true });
	}
	await writeJson(path.join(root, 'packages/a/coverage/coverage-summary.json'), summary(3, 4));
	await writeJson(path.join(root, 'coverage/@example/a/coverage-summary.json'), summary(4, 4));
	await writeJson(path.join(root, 'coverage/@example/b/coverage-summary.json'), summary(4, 4));
	await writeJson(path.join(root, 'coverage/packages/b/coverage-summary.json'), summary(4, 4));
	await writeJson(path.join(root, 'packages/integration/coverage/coverage-summary.json'), summary(4, 4));

	const logs = path.join(root, 'logs/test-coverage');
	await assert.rejects(execFileAsync(process.execPath, [script], { cwd: root }), /@example\/b: packages\/b\/coverage/);
	await assert.rejects(fs.access(logs), { code: 'ENOENT' });

	await writeJson(path.join(root, 'packages/b/coverage/coverage-summary.json'), summary(2, 8));
	await execFileAsync(process.execPath, [script], { cwd: root });
	const readEntry = async name => JSON.parse(await fs.readFile(path.join(logs, '@example', `${name}.json`), 'utf8'))[0];
	const a = await readEntry('a');
	assert.equal(a.measurementScope, 'production-source');
	assert.deepEqual(a.coverage.lines, { covered: 3, total: 4, percentage: 75 });
	assert.deepEqual((await readEntry('b')).coverage.lines, { covered: 2, total: 8, percentage: 25 });
	assert.deepEqual((await readEntry('assets')).coverage.lines, { covered: 0, total: 0, percentage: 100 });
	await assert.rejects(fs.access(path.join(logs, '@example/integration.json')), { code: 'ENOENT' });
	await execFileAsync(process.execPath, [script, '--package-root=packages/a', '--out-dir=isolated'], { cwd: root });
	assert.deepEqual(await fs.readdir(path.join(root, 'isolated/@example')), ['a.json']);
});
