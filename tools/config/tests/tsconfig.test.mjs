import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const nodeModules = path.dirname(path.dirname(require.resolve('typescript/package.json')));

async function createProject(t) {
	const root = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), '8f4e-tsconfig-')));
	t.after(() => fs.rm(root, { recursive: true, force: true }));
	await fs.symlink(nodeModules, path.join(root, 'node_modules'), 'junction');
	const project = path.join(root, 'relocated', 'nested', 'project');
	for (const relative of [
		'src/index.ts',
		'src/index.test.ts',
		'src/__tests__/helper.ts',
		'dist/stale.ts',
		'tests/outside.ts',
	]) {
		const file = path.join(project, relative);
		await fs.mkdir(path.dirname(file), { recursive: true });
		await fs.writeFile(file, 'export {};');
	}
	return project;
}

async function parseConfig(project, filename, config) {
	const file = path.join(project, filename);
	await fs.writeFile(file, JSON.stringify(config));
	const parsed = ts.getParsedCommandLineOfConfigFile(
		file,
		{},
		{
			...ts.sys,
			onUnRecoverableConfigFileDiagnostic: diagnostic =>
				assert.fail(ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n')),
		}
	);
	assert.ok(parsed);
	assert.deepEqual(parsed.errors, []);
	return {
		options: parsed.options,
		files: parsed.fileNames.map(file => path.relative(project, file).split(path.sep).join('/')).sort(),
	};
}

test('library presets resolve build paths and source selection in the consuming project', async t => {
	const project = await createProject(t);
	const presets = [
		{
			name: 'library',
			files: ['src/__tests__/helper.ts', 'src/index.test.ts', 'src/index.ts'],
			lib: undefined,
			types: undefined,
		},
		{
			name: 'node',
			files: ['src/__tests__/helper.ts', 'src/index.ts'],
			lib: ['lib.es2023.d.ts'],
			types: ['node'],
		},
		{
			name: 'dom',
			files: ['src/index.ts'],
			lib: ['lib.es2023.d.ts', 'lib.dom.d.ts'],
			types: undefined,
		},
		{
			name: 'webworker',
			files: ['src/__tests__/helper.ts', 'src/index.ts'],
			lib: ['lib.es2023.d.ts', 'lib.webworker.d.ts'],
			types: undefined,
		},
	];
	for (const preset of presets) {
		const { options, files } = await parseConfig(project, 'tsconfig.json', {
			extends: `@8f4e/config/tsconfig.${preset.name}.json`,
		});
		assert.equal(options.rootDir, path.join(project, 'src'), preset.name);
		assert.equal(options.outDir, path.join(project, 'dist'), preset.name);
		assert.equal(options.noEmit, false, preset.name);
		assert.deepEqual(options.lib, preset.lib, preset.name);
		assert.deepEqual(options.types, preset.types, preset.name);
		assert.deepEqual(files, preset.files, preset.name);
	}
});

test('test overlay retains the library environment and allows project-specific overrides', async t => {
	const project = await createProject(t);
	await parseConfig(project, 'tsconfig.json', { extends: '@8f4e/config/tsconfig.dom.json' });
	const config = {
		extends: ['./tsconfig.json', '@8f4e/config/tsconfig.testing.json'],
		compilerOptions: { rootDir: '.' },
		include: ['**/*.ts'],
	};
	const { options, files } = await parseConfig(project, 'tsconfig.test.json', config);
	assert.equal(options.noEmit, true);
	assert.equal(options.rootDir, project);
	assert.equal(options.outDir, path.join(project, 'dist'));
	assert.deepEqual(options.lib, ['lib.es2023.d.ts', 'lib.dom.d.ts']);
	assert.deepEqual(options.types, ['vitest/globals']);
	assert.deepEqual(files, ['src/__tests__/helper.ts', 'src/index.test.ts', 'src/index.ts', 'tests/outside.ts']);

	const overridden = await parseConfig(project, 'tsconfig.test.json', {
		...config,
		compilerOptions: { ...config.compilerOptions, types: ['node', 'vitest/globals'] },
	});
	assert.deepEqual(overridden.options.types, ['node', 'vitest/globals']);
});

test('the base preset does not impose a library layout on type-only projects', async t => {
	const project = await createProject(t);
	const { options, files } = await parseConfig(project, 'tsconfig.json', {
		extends: '@8f4e/config/tsconfig.base.json',
		compilerOptions: { noEmit: true },
		include: ['tests/**/*.ts'],
	});
	assert.equal(options.noEmit, true);
	assert.equal(options.rootDir, undefined);
	assert.equal(options.outDir, undefined);
	assert.deepEqual(files, ['tests/outside.ts']);
});
