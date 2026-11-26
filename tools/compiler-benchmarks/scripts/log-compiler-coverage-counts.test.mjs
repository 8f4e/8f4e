import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const script = fileURLToPath(new URL('./log-compiler-coverage-counts.mjs', import.meta.url));
const readJson = async file => JSON.parse(await fs.readFile(file, 'utf8'));
const run = root => execFileAsync(process.execPath, ['--jitless', script], { cwd: root });
const logDir = root => path.join(root, 'logs/compiler-coverage-counts');

test('requires JIT-less execution', async () => {
	await assert.rejects(execFileAsync(process.execPath, [script]), /Run compiler coverage counts with node --jitless/);
});

test('preserves old series and records identical fresh and partial-rerun measurements', async t => {
	const root = await fs.mkdtemp(path.join(os.tmpdir(), '8f4e-coverage-counts-'));
	t.after(() => fs.rm(root, { recursive: true, force: true }));
	const first = path.join(root, 'first');
	const second = path.join(root, 'second');
	await fs.mkdir(logDir(first), { recursive: true });
	await fs.mkdir(logDir(second), { recursive: true });
	const { version } = await readJson(new URL(import.meta.resolve('@8f4e/compiler/package.json')));
	const oldEntry = {
		schemaVersion: 2,
		version,
		commit: 'historical',
		benchmark: 'sineGenerator.8f4e',
		coverage: { compiler: { rangeExecutions: 10 } },
	};
	const sineLog = path.join(logDir(first), 'sineGenerator.json');
	await fs.writeFile(sineLog, JSON.stringify([oldEntry]));

	await run(first);
	await run(second);
	const filenames = (await fs.readdir(logDir(second))).filter(file => file.endsWith('.json'));
	assert.ok(filenames.length >= 5);
	const firstSine = await readJson(sineLog);
	assert.deepEqual(firstSine[0], oldEntry);
	assert.equal(firstSine.length, 2);
	const expected = new Map();
	for (const filename of filenames) {
		const [entry] = await readJson(path.join(logDir(second), filename));
		expected.set(filename, entry);
		assert.equal(entry.measurementMode, 'jitless');
		assert.equal(entry.schemaVersion, 3);
		assert.equal(entry.nodeVersion, process.version);
		assert.ok(entry.coverage.compiler.rangeExecutions > 0);
		assert.ok(entry.coverage.tokenizer.rangeExecutions > 0);
		assert.deepEqual((await readJson(path.join(logDir(first), filename))).at(-1), entry);
	}

	// Repair a partially logged release and verify neither legacy nor existing deterministic entries are replaced.
	await fs.writeFile(sineLog, JSON.stringify([oldEntry]));
	await run(first);
	for (const [filename, entry] of expected) {
		const entries = await readJson(path.join(logDir(first), filename));
		assert.deepEqual(entries, filename === 'sineGenerator.json' ? [oldEntry, entry] : [entry]);
	}
	const { stdout } = await run(first);
	assert.match(stdout, /already has entries/);
	assert.deepEqual(await readJson(sineLog), firstSine);
});
