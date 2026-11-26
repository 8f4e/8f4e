import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const script = fileURLToPath(new URL('./log-bundle-sizes.mjs', import.meta.url));

test('measures a package in a relocated directory using only its name and package-relative distDir', async t => {
	const root = await fs.mkdtemp(path.join(os.tmpdir(), '8f4e-bundle-size-'));
	t.after(() => fs.rm(root, { recursive: true, force: true }));
	const packageName = '@example/relocated';
	const packageLocation = 'anywhere/new-location';
	const packageRoot = path.join(root, packageLocation);
	const distRoot = path.join(packageRoot, 'custom/output');
	await fs.mkdir(distRoot, { recursive: true });
	await fs.writeFile(
		path.join(root, 'package-lock.json'),
		JSON.stringify({
			packages: {
				[packageLocation]: { name: packageName },
				[`node_modules/${packageName}`]: { link: true, resolved: packageLocation },
			},
		})
	);
	await fs.writeFile(path.join(packageRoot, 'package.json'), JSON.stringify({ name: packageName, version: '1.0.0' }));
	const contents = 'export const n = 42;\n';
	await fs.writeFile(path.join(distRoot, 'index.js'), contents);
	const config = {
		packages: { [packageName]: { distDir: 'custom/output', entries: [{ name: 'index.js', pattern: '^index\\.js$' }] } },
	};
	const configPath = path.join(root, 'bundle-size.config.json');
	await fs.writeFile(configPath, JSON.stringify(config));
	await execFileAsync(process.execPath, [script], { cwd: root });
	const [entry] = JSON.parse(await fs.readFile(path.join(root, 'logs/bundle-sizes', `${packageName}.json`), 'utf8'));
	assert.equal(entry.packageName, packageName);
	assert.equal(entry.bytes.raw, Buffer.byteLength(contents));
	assert.ok(entry.bytes.gzip > 0);

	config.packages[packageName].distDir = '../misplaced';
	await fs.writeFile(configPath, JSON.stringify(config));
	await assert.rejects(
		execFileAsync(process.execPath, [script], { cwd: root }),
		/distDir must be a package-relative path/
	);
});
