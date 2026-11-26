import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { getOptionValues, projectsFromGraph } from './workspace-projects.mjs';

async function createWorkspace(t) {
	const root = await fs.mkdtemp(path.join(os.tmpdir(), '8f4e-workspace-projects-'));
	t.after(() => fs.rm(root, { recursive: true, force: true }));
	return root;
}

function project(name, root, sourceRoot, { packageName = name, workspace = true, test = false } = {}) {
	return {
		name,
		data: {
			root,
			sourceRoot,
			targets: test ? { test: {} } : {},
			metadata: { js: { packageName, packageVersion: '1.0.0', isInPackageManagerWorkspaces: workspace } },
		},
	};
}

test('uses Nx package membership and project metadata without reading the lockfile or project manifests', async t => {
	const root = await createWorkspace(t);
	await fs.mkdir(path.join(root, 'compiler/stdlib/std'), { recursive: true });
	await fs.mkdir(path.join(root, 'apps/ui/src'), { recursive: true });
	await fs.mkdir(path.join(root, 'tools/standalone/src'), { recursive: true });
	const graph = {
		nodes: {
			stdlib: project('stdlib', 'compiler/stdlib', 'compiler/stdlib/std', {
				packageName: '@example/stdlib',
				test: true,
			}),
			ui: project('ui', 'apps/ui', 'apps/ui/src'),
			tests: project('tests', 'apps/ui/tests', undefined, { test: true }),
			standalone: project('standalone', 'tools/standalone', 'tools/standalone/src', { workspace: false }),
			native: { name: 'native', data: { root: 'apps/native' } },
		},
	};
	const projects = await projectsFromGraph(root, graph);
	assert.deepEqual(
		projects.map(p => p.name),
		['ui', 'tests', '@example/stdlib']
	);
	assert.deepEqual(projects.at(-1), {
		name: '@example/stdlib',
		projectName: 'stdlib',
		version: '1.0.0',
		root: path.join(root, 'compiler/stdlib'),
		relativeRoot: 'compiler/stdlib',
		sourceRoot: path.join(root, 'compiler/stdlib/std'),
		hasTestTarget: true,
	});
	assert.equal(projects[1].sourceRoot, null);
	assert.deepEqual(
		(await projectsFromGraph(root, graph, ['apps/ui'])).map(p => p.name),
		['ui', 'tests']
	);
	assert.deepEqual(
		(await projectsFromGraph(root, graph, ['tools'])).map(p => p.name),
		['standalone']
	);
});

test('uses only workspace-relative source roots, with the standalone renderer adapter as an explicit exception', async t => {
	const root = await createWorkspace(t);
	await fs.mkdir(path.join(root, 'apps/ui/src'), { recursive: true });
	await fs.mkdir(path.join(root, 'editor/core/glugglugglug/src'), { recursive: true });
	await fs.mkdir(path.join(root, 'src'));
	const graph = {
		nodes: {
			renderer: project('glugglugglug', 'editor/core/glugglugglug', 'src'),
		},
	};
	assert.equal((await projectsFromGraph(root, graph))[0].sourceRoot, path.join(root, 'editor/core/glugglugglug/src'));
	graph.nodes.ui = project('ui', 'apps/ui', 'src');
	await assert.rejects(projectsFromGraph(root, graph), /sourceRoot src must be workspace-relative/);
});

test('supports repeated project filters and alternate output directories', () => {
	const args = ['--package-root', 'compiler', '--out-dir=logs.tmp', '--package-root=editor'];
	assert.deepEqual(getOptionValues(args, '--package-root'), ['compiler', 'editor']);
	assert.deepEqual(getOptionValues(args, '--out-dir'), ['logs.tmp']);
	assert.throws(() => getOptionValues(['--out-dir'], '--out-dir'), /requires a value/);
	assert.throws(() => getOptionValues(['--out-dir='], '--out-dir'), /requires a value/);
	assert.throws(() => getOptionValues(['--out-dir', '--package-root=editor'], '--out-dir'), /requires a value/);
});
