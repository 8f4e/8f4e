import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import fs from 'node:fs/promises';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const require = createRequire(import.meta.url);
const vitestRoot = path.dirname(require.resolve('vitest/package.json'));

test('Vitest reports all production files and no test helpers in the project-local coverage directory', async t => {
	const root = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), '8f4e-vitest-coverage-')));
	t.after(() => fs.rm(root, { recursive: true, force: true }));
	await fs.symlink(path.dirname(vitestRoot), path.join(root, 'node_modules'), 'junction');
	const files = {
		'package.json': '{"type":"module"}',
		'vitest.config.mjs': `import { createNodePreset } from '@8f4e/config/vitest';
export default createNodePreset({ typecheckEnabled: false });`,
		'src/covered.ts': 'export function covered() { return 1; }',
		'src/unimported.ts': 'export function unimported() { return 2; }',
		'src/tests/catalog.ts': 'export function catalog() { return 3; }',
		'src/__tests__/helper.ts': 'export function helper() { return true; }',
		'src/fixtures/fixture.ts': 'export function fixture() { return true; }',
		'src/generated/catalog.ts': 'export const catalog = [1, 2, 3];',
		'src/fonts/example/generated/data.ts': 'export const data = [4, 5, 6];',
		'src/types.d.ts': 'export declare function stub(): number;',
		'src/covered.test.ts': `import { test, expect } from 'vitest';
import { covered } from './covered';
import { helper } from './__tests__/helper';
import { fixture } from './fixtures/fixture';
test('covered', () => { expect(covered()).toBe(1); expect(helper()).toBe(true); expect(fixture()).toBe(true); });`,
	};
	for (const [relative, contents] of Object.entries(files)) {
		const file = path.join(root, relative);
		await fs.mkdir(path.dirname(file), { recursive: true });
		await fs.writeFile(file, contents);
	}
	await execFileAsync(process.execPath, [path.join(vitestRoot, 'vitest.mjs'), 'run', '--coverage'], { cwd: root });
	const summary = JSON.parse(await fs.readFile(path.join(root, 'coverage/coverage-summary.json'), 'utf8'));
	const measured = Object.fromEntries(
		Object.entries(summary)
			.filter(([file]) => file !== 'total')
			.map(([file, value]) => [path.relative(root, file).split(path.sep).join('/'), value.lines.covered])
	);
	assert.deepEqual(measured, {
		'src/covered.ts': 1,
		'src/unimported.ts': 0,
		'src/tests/catalog.ts': 0,
	});
	assert.equal(summary.total.lines.total, 3);
	assert.equal(summary.total.lines.covered, 1);
});
