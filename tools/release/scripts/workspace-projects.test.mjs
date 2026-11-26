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

function project(name, root, { packageName = name, workspace = true, test = false, sourceDirectory } = {}) {
	return {
		name,
		data: {
			root,
			targets: test ? { test: {} } : {},
			metadata: {
				js: { packageName, packageVersion: '1.0.0', isInPackageManagerWorkspaces: workspace },
				...(sourceDirectory ? { metrics: { sourceDirectory } } : {}),
			},
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
			stdlib: project('stdlib', 'compiler/stdlib', {
				packageName: '@example/stdlib',
				test: true,
				sourceDirectory: 'std',
			}),
			ui: project('ui', 'apps/ui'),
			tests: project('tests', 'apps/ui/tests', { test: true }),
			standalone: project('standalone', 'tools/standalone', { workspace: false }),
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
	assert.equal(projects[0].sourceRoot, path.join(root, 'apps/ui/src'));
	assert.deepEqual(
		(await projectsFromGraph(root, graph, ['apps/ui'])).map(p => p.name),
		['ui', 'tests']
	);
	assert.deepEqual(
		(await projectsFromGraph(root, graph, ['tools'])).map(p => p.name),
		['standalone']
	);
	await assert.rejects(
		projectsFromGraph(root, graph, ['apps/ui', 'missing']),
		/No Nx package projects found under --package-root missing/
	);
});

test('derives source directories from graph roots without relying on sourceRoot metadata', async t => {
	const root = await createWorkspace(t);
	await fs.mkdir(path.join(root, 'apps/ui/src'), { recursive: true });
	await fs.mkdir(path.join(root, 'editor/core/glugglugglug/src'), { recursive: true });
	await fs.mkdir(path.join(root, 'elsewhere/ui/src'), { recursive: true });
	await fs.mkdir(path.join(root, 'elsewhere/stdlib/std'), { recursive: true });
	await fs.mkdir(path.join(root, 'src'));
	const graph = {
		nodes: {
			renderer: project('glugglugglug', 'editor/core/glugglugglug'),
			ui: project('ui', 'apps/ui'),
			stdlib: project('stdlib', 'elsewhere/stdlib', { sourceDirectory: 'std' }),
		},
	};
	graph.nodes.renderer.data.sourceRoot = 'src'; // Standalone submodule metadata is not needed by the parent metrics.
	const getSource = async name =>
		(await projectsFromGraph(root, graph)).find(project => project.name === name).sourceRoot;
	assert.equal(await getSource('glugglugglug'), path.join(root, 'editor/core/glugglugglug/src'));
	assert.equal(await getSource('ui'), path.join(root, 'apps/ui/src'));
	assert.equal(await getSource('stdlib'), path.join(root, 'elsewhere/stdlib/std'));
	graph.nodes.ui.data.root = 'elsewhere/ui';
	assert.equal(await getSource('ui'), path.join(root, 'elsewhere/ui/src'));
});

test('supports repeated project filters and alternate output directories', () => {
	const args = ['--package-root', 'compiler', '--out-dir=logs.tmp', '--package-root=editor'];
	assert.deepEqual(getOptionValues(args, '--package-root'), ['compiler', 'editor']);
	assert.deepEqual(getOptionValues(args, '--out-dir'), ['logs.tmp']);
	assert.throws(() => getOptionValues(['--out-dir'], '--out-dir'), /requires a value/);
	assert.throws(() => getOptionValues(['--out-dir='], '--out-dir'), /requires a value/);
	assert.throws(() => getOptionValues(['--out-dir', '--package-root=editor'], '--out-dir'), /requires a value/);
});
