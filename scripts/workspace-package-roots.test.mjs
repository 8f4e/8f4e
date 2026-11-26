import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { getWorkspacePackageRoots, resolveWorkspaceSourceRoot } from './workspace-package-roots.mjs';

async function createWorkspace(t) {
	const root = await fs.mkdtemp(path.join(os.tmpdir(), '8f4e-workspace-roots-'));
	t.after(() => fs.rm(root, { recursive: true, force: true }));
	return root;
}

test('discovers root npm workspace links without including standalone tools or nested dependency links', async t => {
	const root = await createWorkspace(t);
	await fs.writeFile(
		path.join(root, 'package-lock.json'),
		JSON.stringify({
			packages: {
				'': {},
				compiler: { name: '@8f4e/compiler' },
				'tools/config': { name: '@8f4e/config' },
				'tools/project-preview': { name: '@8f4e/project-preview' },
				'node_modules/@8f4e/compiler': { link: true, resolved: 'compiler' },
				'node_modules/@8f4e/config': { link: true, resolved: 'tools/config' },
				'node_modules/ordinary': { version: '1.0.0' },
				'node_modules/ordinary/node_modules/@8f4e/project-preview': { link: true, resolved: 'tools/project-preview' },
			},
		})
	);

	assert.deepEqual(await getWorkspacePackageRoots(root), [
		path.join(root, 'compiler'),
		path.join(root, 'tools/config'),
	]);
});

test('resolves both source-root conventions without falling back to unrelated default source directories', async t => {
	const root = await createWorkspace(t);
	const project = path.join(root, 'apps/metrics-dashboard');
	const source = path.join(project, 'src');
	await fs.mkdir(source, { recursive: true });
	await fs.mkdir(path.join(root, 'src'));

	assert.equal(await resolveWorkspaceSourceRoot(root, project), source);
	assert.equal(await resolveWorkspaceSourceRoot(root, project, 'src'), source);
	assert.equal(await resolveWorkspaceSourceRoot(root, project, 'apps/metrics-dashboard/src'), source);
	assert.equal(await resolveWorkspaceSourceRoot(root, path.join(root, 'compiler')), null);
});
