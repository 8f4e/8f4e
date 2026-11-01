import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { relative } from 'node:path';

// Keep the audit local and inspect the planner used by this workspace's pinned Nx version.
process.env.NX_DAEMON = 'false';
const require = createRequire(import.meta.url);
const { createProjectGraphAsync, workspaceRoot } = require('@nx/devkit');
const { HashPlanInspector } = require('nx/src/hasher/hash-plan-inspector');
const graph = await createProjectGraphAsync();
const inspector = new HashPlanInspector(graph);
await inspector.init();
const projects = Object.values(graph.nodes).sort((a, b) => b.data.root.length - a.data.root.length);
const owner = file => projects.find(project => file.startsWith(`${project.data.root}/`));
const testFile = file =>
	/(^|\/)(tests|screenshot-tests|browser-tests|__tests__|__snapshots__|__screenshots__|fixtures)(\/|$)|\.(test|spec)\.[^/]+$|(^|\/)(vitest.*\.config|playwright\.config|jest\.image)\./.test(
		file
	);
const shippedFixture = (project, file) =>
	project === '@8f4e/8f4e-website' &&
	(/^packages\/compiler\/tests\/.*\.test\.8f4e$/.test(file) || file.startsWith('packages/8f4e-website/src/tests/'));
const plans = new Map();
function inputs(project, target) {
	const id = `${project}:${target}`;
	if (!plans.has(id)) plans.set(id, inspector.inspectTaskInputs({ project, target }));
	return plans.get(id);
}
function files(project, target) {
	return inputs(project, target)[`${project}:${target}`].files;
}
function expectInput(project, target, file, expected = true) {
	assert.equal(files(project, target).includes(file), expected, `${project}:${target}: ${file}`);
}
function projectFile(project, predicate) {
	const root = graph.nodes[project].data.root;
	const file = files(project, 'build').find(
		path => path.startsWith(`${root}/`) && predicate(path.slice(root.length + 1))
	);
	assert.ok(file, `No representative production file found for ${project}`);
	return file;
}

let targets = 0;
for (const project of projects) {
	for (const target of ['build', 'build-deps', 'generate-content', 'generate-fonts', 'typecheck:production']) {
		if (!project.data.targets?.[target]) continue;
		targets++;
		const plan = inputs(project.name, target);
		for (const file of plan[`${project.name}:${target}`].files) {
			const dependency = owner(file);
			if (!dependency) continue;
			const path = relative(dependency.data.root, file);
			assert.ok(
				!testFile(path) || shippedFixture(project.name, file),
				`${project.name}:${target} hashes test-only file ${file}`
			);
		}
		for (const id of Object.keys(plan)) {
			const taskTarget = id.slice(id.indexOf(':') + 1);
			assert.ok(!/^test(?::|$)/.test(taskTarget), `${project.name}:${target} schedules ${id}`);
		}
	}
}

const sprite = graph.nodes['@8f4e/sprite-generator'].data.root;
const fixture = `${sprite}/tests/fixtures/palettes.ts`;
for (const project of [
	'@8f4e/sprite-generator',
	'@8f4e/editor-core',
	'@8f4e/editor-minimal',
	'@8f4e/editor-default',
	'@8f4e/8f4e-website',
]) {
	expectInput(project, 'build', fixture, false);
}
for (const target of ['test', 'test:screenshot']) expectInput('@8f4e/sprite-generator', target, fixture);
expectInput('@8f4e/sprite-generator', 'generate-fonts', `${sprite}/src/fonts/ibmvga8x16/ascii.ts`);
expectInput(
	'@8f4e/sprite-generator',
	'test',
	projectFile('@8f4e/editor-palette', file => file === 'src/resolvePalette.ts')
);

for (const project of ['@8f4e/sprite-generator', '@8f4e/editor-minimal']) {
	assert.ok(
		!files(project, 'build').some(file => file.startsWith('packages/examples/')),
		`${project}: examples leaked into production`
	);
	assert.ok(
		!Object.keys(inputs(project, 'build')).includes('@8f4e/examples:build'),
		`${project}: examples build prerequisite leaked`
	);
}
for (const project of ['@8f4e/sprite-generator', '@8f4e/editor-core', '@8f4e/editor-minimal']) {
	expectInput(project, 'build', `${sprite}/src/font.ts`);
}
const examples = [
	'packages/examples/src/modules/color-schemes/dx7.8f4em',
	'packages/examples/src/projects/misc/landingPageDemo1.8f4e',
];
for (const file of examples) {
	for (const project of ['@8f4e/editor-webmcp', '@8f4e/8f4e-website']) expectInput(project, 'build', file);
	expectInput('@8f4e/editor-webmcp', 'generate-content', file);
}
expectInput('@8f4e/editor-default', 'build', examples[0]);
// CLI example verification belongs to test inputs without a reverse build edge.
expectInput('@8f4e/cli', 'build', 'packages/examples/src/projects/audio/audioBuffer.8f4e', false);
expectInput('@8f4e/cli', 'test', 'packages/examples/src/projects/audio/audioBuffer.8f4e');
const compilerFixture = files('@8f4e/8f4e-website', 'build').find(file =>
	/^packages\/compiler\/tests\/.*\.test\.8f4e$/.test(file)
);
assert.ok(compilerFixture, 'The published test gallery lost its compiler fixtures');
expectInput('@8f4e/compiler', 'build', compilerFixture, false);
expectInput('@8f4e/compiler', 'test', compilerFixture);
expectInput('@8f4e/8f4e-website', 'typecheck:production', compilerFixture);
for (const prefix of ['packages/compiler/docs/', 'packages/editor/packages/editor-core/docs/']) {
	assert.ok(
		files('@8f4e/editor-webmcp', 'generate-content').some(file => file.startsWith(prefix) && file.endsWith('.md')),
		`Missing catalog input ${prefix}`
	);
}
const stdlibRoot = graph.nodes['@8f4e/stdlib'].data.root;
for (const project of ['@8f4e/editor-minimal', '@8f4e/editor-default']) {
	assert.ok(
		files(project, 'build').some(file => file.startsWith(`${stdlibRoot}/std/`) && file.endsWith('.8f4e')),
		`${project}: missing stdlib`
	);
}
for (const [consumer, dependency] of [
	['@8f4e/editor-plugin-compiler', '@8f4e/compiler-worker'],
	['@8f4e/editor-plugin-audio-runtime', '@8f4e/runtime-audio-worklet'],
	['@8f4e/editor-plugin-worker-runtime', '@8f4e/runtime-web-worker'],
]) {
	expectInput(
		consumer,
		'build',
		projectFile(dependency, file => file.startsWith('src/') && file.endsWith('.ts') && !testFile(file))
	);
	assert.ok(
		Object.keys(inputs(consumer, 'build')).includes(`${dependency}:build`),
		`${consumer}: missing ${dependency} build`
	);
}
console.log(
	`Checked ${projects.length} projects and ${targets} production targets: known test files excluded, shipped sources retained, and no test prerequisites.`
);

if (process.argv.includes('--inventory')) {
	// This is an inventory of source references, not a rule to delete dependencies.
	// A devDependency may still be required by tsc, Vite, or a content generator.
	const fileMap = JSON.parse(readFileSync(`${workspaceRoot}/.nx/workspace-data/file-map.json`, 'utf8')).fileMap
		.projectFileMap;
	const names = Object.keys(graph.nodes);
	console.log('\n| Consumer | Test-only references (first evidence file) |\n| --- | --- |');
	for (const project of projects.toSorted((a, b) => a.name.localeCompare(b.name))) {
		const references = new Map();
		for (const entry of fileMap[project.name] ?? []) {
			const path = relative(project.data.root, entry.file);
			if (!/\.(ts|tsx|js|mjs|cjs|json|html)$/.test(path) || /(^|\/)(package|project)(-lock)?\.json$/.test(path))
				continue;
			const source = readFileSync(`${workspaceRoot}/${entry.file}`, 'utf8');
			for (const name of names) {
				if (name === project.name || !source.includes(name)) continue;
				const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
				if (!new RegExp(`${escaped}(?:['"/])`).test(source)) continue;
				const paths = references.get(name) ?? [];
				paths.push(path);
				references.set(name, paths);
			}
		}
		const testOnly = [...references].filter(([, paths]) => paths.every(testFile));
		if (testOnly.length)
			console.log(
				`| \`${project.name}\` | ${testOnly.map(([name, paths]) => `\`${name}\` (${paths[0]})`).join('; ')} |`
			);
	}
}
