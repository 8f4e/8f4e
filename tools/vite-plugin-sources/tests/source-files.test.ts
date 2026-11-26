import fs from 'node:fs';
import { mkdir, mkdtemp, readFile, realpath, rm, unlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { InlineConfig, Rollup } from 'vite';
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import { sourceFiles, sourceUrls } from '../src/index';

const cleanups: Array<() => Promise<unknown>> = [];
let blockedDirectory: string | undefined;
const pendingDirectoryStats: Array<() => void> = [];

function releaseDirectoryScan() {
	blockedDirectory = undefined;
	for (const resume of pendingDirectoryStats.splice(0)) resume();
}

// Install before loading Vite/Rollup so their promisified filesystem calls can be gated.
const statSpies = (['stat', 'lstat'] as const).map(method => {
	const original = fs[method];
	return vi.spyOn(fs, method).mockImplementation((...args) => {
		const resume = () => Reflect.apply(original, fs, args);
		if (blockedDirectory !== undefined && resolve(String(args[0])) === blockedDirectory)
			pendingDirectoryStats.push(resume);
		else resume();
	});
});
const { build, createServer } = await import('vite');

afterAll(() => {
	for (const spy of statSpies) spy.mockRestore();
});

afterEach(async () => {
	releaseDirectoryScan();
	for (const cleanup of cleanups.reverse()) {
		await cleanup();
	}
	cleanups.length = 0;
});

async function fixture(files: Record<string, string>, kind: 'text' | 'url' = 'text') {
	const root = await mkdtemp(join(tmpdir(), '8f4e-sources-'));
	cleanups.push(() => rm(root, { recursive: true, force: true }));
	const host = join(root, 'host');
	const sources = join(root, 'source files ü');
	const outDir = join(root, 'library');
	await mkdir(host);
	await mkdir(sources);
	await writeFile(join(root, 'package.json'), '{"type":"module"}');
	async function write(path: string, text: string) {
		const file = join(sources, path);
		await mkdir(dirname(file), { recursive: true });
		await writeFile(file, text);
	}
	await Promise.all(Object.entries(files).map(([path, text]) => write(path, text)));
	const entry = join(host, 'main.js');
	const namespace = kind === 'text' ? '8f4e-sources' : '8f4e-source-urls';
	const collection = kind === 'text' ? sourceFiles : sourceUrls;
	await writeFile(entry, `export { default as sources } from 'virtual:${namespace}/programs';`);
	const config: InlineConfig = {
		root: host,
		configFile: false,
		envFile: false,
		publicDir: false,
		logLevel: 'silent',
		plugins: [collection({ name: 'programs', root: pathToFileURL(sources), exclude: ['ignored/**'] })],
		build: { outDir, minify: false, lib: { entry, formats: ['es'], fileName: () => 'index.js' } },
	};
	return { root, host, sources, outDir, entry, config, write };
}

async function buildOutput(config: InlineConfig) {
	const result = await build({ ...config });
	const output = Array.isArray(result) ? result[0] : result;
	if (!('output' in output)) {
		throw new Error('Expected a completed build');
	}
	return output.output;
}

async function importCollection(directory: string) {
	return (await import(`${pathToFileURL(join(directory, 'index.js')).href}?revision=${Date.now()}`)) as {
		sources: ReadonlyMap<string, () => Promise<string>>;
	};
}

describe('sourceFiles', () => {
	it('discovers stable IDs and preserves text in lazy chunks through two builds', async () => {
		const text = '; unique source text\r\n"quoted" \\ Unicode: 音\r\n';
		const project = await fixture({
			'math/fraction.8f4e': text,
			'top.8f4e': 'another source\n',
			'ignored/private.8f4e': 'excluded source',
			'notes.txt': 'unmatched file',
		});
		const output = await buildOutput(project.config);
		const entry = output.find(file => file.type === 'chunk' && file.isEntry);
		expect(entry?.type === 'chunk' && entry.dynamicImports).toHaveLength(2);
		expect(entry?.type === 'chunk' && entry.code).not.toContain('unique source text');
		const { sources } = await importCollection(project.outDir);
		expect([...sources.keys()]).toEqual(['math/fraction', 'top']);
		expect(await sources.get('math/fraction')?.()).toBe(text);
		expect(await sources.get('math/fraction')?.()).toBe(text);
		expect(sources.get('toString')).toBeUndefined();
		expect(sources.get('__proto__')).toBeUndefined();

		// Consume the built library, rather than discovering the files again.
		const consumerEntry = join(project.host, 'consumer.js');
		await writeFile(consumerEntry, "export { sources } from '../library/index.js';");
		const consumerOut = join(project.root, 'consumer');
		const consumerOutput = await buildOutput({
			...project.config,
			plugins: [],
			build: {
				outDir: consumerOut,
				minify: false,
				lib: { entry: consumerEntry, formats: ['es'], fileName: () => 'index.js' },
			},
		});
		expect(consumerOutput.filter(file => file.type === 'chunk' && file.isDynamicEntry)).toHaveLength(2);
		expect(await (await importCollection(consumerOut)).sources.get('math/fraction')?.()).toBe(text);
	});

	it('supports relative roots, include patterns, and independent collections', async () => {
		const project = await fixture({ 'one/a.8f4e': 'first', 'two/b.8f4em': 'second', 'two/skip.8f4e': 'skip' });
		await writeFile(
			project.entry,
			"export { default as sources } from 'virtual:8f4e-sources/first';\n" +
				"export { default as other } from 'virtual:8f4e-sources/second';"
		);
		await buildOutput({
			...project.config,
			plugins: [
				sourceFiles({ name: 'first', root: relative(project.host, project.sources), include: ['one/*.8f4e'] }),
				sourceFiles({ name: 'second', root: project.sources, include: ['two/*.8f4em'] }),
			],
		});
		const { sources, other } = (await importCollection(project.outDir)) as Awaited<
			ReturnType<typeof importCollection>
		> & { other: ReadonlyMap<string, () => Promise<string>> };
		expect([...sources.keys()]).toEqual(['one/a']);
		expect([...other.keys()]).toEqual(['two/b']);
		expect(await other.get('two/b')?.()).toBe('second');
	});

	it('rejects colliding IDs and duplicate collection names', async () => {
		const project = await fixture({ 'same.8f4e': 'first', 'same.8f4em': 'second' });
		await expect(
			buildOutput({
				...project.config,
				plugins: [sourceFiles({ name: 'programs', root: project.sources, include: ['*.{8f4e,8f4em}'] })],
			})
		).rejects.toThrow('Duplicate source ID "same": same.8f4e and same.8f4em');
		await expect(
			buildOutput({
				...project.config,
				plugins: [
					sourceFiles({ name: 'programs', root: project.sources }),
					sourceFiles({ name: 'programs', root: '.' }),
				],
			})
		).rejects.toThrow('Duplicate source collection: programs');
	});

	it('keeps source-loading failures observable', async () => {
		const project = await fixture({ 'unavailable.8f4e': 'source' });
		const output = await buildOutput(project.config);
		const source = output.find(file => file.type === 'chunk' && file.isDynamicEntry);
		if (!source) throw new Error('Expected a source chunk');
		const { sources } = await importCollection(project.outDir);
		await unlink(join(project.outDir, source.fileName));
		await expect(sources.get('unavailable')?.()).rejects.toThrow();
	});

	it('refreshes development collections on additions and removals without eager source transforms', async () => {
		const project = await fixture({ 'before.8f4e': 'before' });
		await mkdir(join(project.sources, 'nested'));
		const server = await createServer({
			...project.config,
			optimizeDeps: { noDiscovery: true, include: [] },
			server: { middlewareMode: true, hmr: false, preTransformRequests: false },
		});
		cleanups.push(() => server.close());
		const moduleId = 'virtual:8f4e-sources/programs';
		const initial = await server.transformRequest(moduleId);
		expect(initial?.code).toContain('"before"');
		const transformedSources = () =>
			[...server.environments.client.moduleGraph.idToModuleMap.values()].filter(
				module => module.id?.split('?')[0].endsWith('.8f4e') && module.transformResult
			).length;
		expect(transformedSources()).toBe(0);
		await expect
			.poll(() => Object.values(server.watcher.getWatched()).flat().includes('before.8f4e'), { timeout: 5000 })
			.toBe(true);
		await project.write('nested/added.8f4e', 'added source');
		await expect
			.poll(async () => (await server.transformRequest(moduleId))?.code, { timeout: 5000 })
			.toContain('"nested/added"');
		await unlink(join(project.sources, 'before.8f4e'));
		await expect
			.poll(async () => (await server.transformRequest(moduleId))?.code, { timeout: 5000 })
			.not.toContain('"before"');
		const updated = await server.transformRequest(moduleId);
		const sourceUrl = updated?.code.match(/import\(\s*["']([^"']+)["']/)?.[1];
		if (!sourceUrl) throw new Error('Expected a lazy source import');
		expect((await server.transformRequest(sourceUrl))?.code).toContain('added source');
		expect(transformedSources()).toBe(1);
	});

	it.each([
		{ kind: 'text', startup: 'normal' },
		{ kind: 'text', startup: 'blocked' },
		{ kind: 'url', startup: 'normal' },
		{ kind: 'url', startup: 'blocked' },
	] as const)('discovers $kind changes with $startup build-watch startup', async ({ kind, startup }) => {
		const project = await fixture({ 'before.8f4e': 'before' }, kind);
		await mkdir(join(project.sources, 'empty'));
		const sources = await realpath(project.sources);
		const empty = join(sources, 'empty');
		const nativeWatches = vi.spyOn(fs, 'watch');
		cleanups.push(async () => nativeWatches.mockRestore());
		if (startup === 'blocked') blockedDirectory = empty;
		// Use the Node backend on every platform to observe actual directory-watch registration.
		const result = await build({
			...project.config,
			build: { ...project.config.build, watch: { chokidar: { useFsEvents: false, usePolling: false } } },
		});
		if (Array.isArray(result) || !('on' in result)) throw new Error('Expected a build watcher');
		const watcher: Rollup.RollupWatcher = result;
		cleanups.push(() => watcher.close());
		function nextBuild() {
			return new Promise<void>((resolve, reject) => {
				const listener = (event: Rollup.RollupWatcherEvent) => {
					if (event.code === 'ERROR') {
						watcher.off('event', listener);
						reject(event.error);
					} else if (event.code === 'BUNDLE_END') {
						watcher.off('event', listener);
						event.result.close().then(resolve, reject);
					}
				};
				watcher.on('event', listener);
			});
		}
		await nextBuild();
		const watchedPaths = () => nativeWatches.mock.calls.map(([watched]) => resolve(String(watched)));
		const ready = expect
			.poll(watchedPaths, { timeout: 5000 })
			.toEqual(expect.arrayContaining([sources, empty, join(sources, 'before.8f4e')]));
		if (startup === 'blocked') {
			// BUNDLE_END can precede the initial directory scan. Keep that ordering deterministic.
			await expect.poll(() => pendingDirectoryStats.length, { timeout: 5000 }).toBeGreaterThan(0);
			expect(watchedPaths()).not.toContain(empty);
			releaseDirectoryScan();
		}
		// BUNDLE_END means output is written, not that Chokidar's initial scan has finished.
		await ready;
		const addition = nextBuild();
		await project.write('empty/added.8f4e', 'new source');
		await addition;
		const addedId = kind === 'text' ? 'empty/added' : 'empty/added.8f4e';
		const beforeId = kind === 'text' ? 'before' : 'before.8f4e';
		expect(await readFile(join(project.outDir, 'index.js'), 'utf8')).toContain(`"${addedId}"`);
		const removal = nextBuild();
		await unlink(join(project.sources, 'before.8f4e'));
		await removal;
		expect(await readFile(join(project.outDir, 'index.js'), 'utf8')).not.toContain(`"${beforeId}"`);
	});
});

describe('sourceUrls', () => {
	it('exports stable paths with extensions and emits exact external assets without inlining', async () => {
		const text = '; tiny source\r\n"quoted" \\ Unicode: 音\r\n';
		const project = await fixture(
			{
				'math/fraction.8f4e': text,
				'math/fraction.8f4em': 'other extension',
				'top.8f4e': 'top',
				'ignored/private.8f4e': 'excluded source',
				'notes.txt': 'unmatched file',
			},
			'url'
		);
		await writeFile(
			project.entry,
			"export { default as urls } from 'virtual:8f4e-source-urls/programs';\n" +
				"export { default as sources } from 'virtual:8f4e-sources/programs';"
		);
		const output = await buildOutput({
			...project.config,
			base: '/',
			plugins: [
				sourceUrls({
					name: 'programs',
					root: project.sources,
					include: ['**/*.{8f4e,8f4em}'],
					exclude: ['ignored/**'],
				}),
				sourceFiles({ name: 'programs', root: project.sources, include: ['top.8f4e'] }),
			],
			build: {
				outDir: project.outDir,
				minify: false,
				rollupOptions: {
					input: project.entry,
					preserveEntrySignatures: 'strict',
					output: { entryFileNames: 'index.js' },
				},
			},
		});
		const { urls, sources } = (await importCollection(project.outDir)) as Awaited<
			ReturnType<typeof importCollection>
		> & {
			urls: ReadonlyMap<string, string>;
		};
		expect([...urls.keys()]).toEqual(['math/fraction.8f4e', 'math/fraction.8f4em', 'top.8f4e']);
		expect(urls.get('__proto__')).toBeUndefined();
		expect([...sources.keys()]).toEqual(['top']);
		const assets = output.filter(file => file.type === 'asset');
		expect(assets).toHaveLength(3);
		for (const [path, url] of urls) {
			expect(url).toMatch(/^\/assets\//);
			expect(assets.some(asset => url === `/${asset.fileName}`)).toBe(true);
			expect(await readFile(join(project.outDir, url.slice(1)))).toEqual(await readFile(join(project.sources, path)));
		}
		expect(await sources.get('top')?.()).toBe('top');
	});

	it('refreshes the development URL collection when sources are added and removed', async () => {
		const project = await fixture({ 'before.8f4e': 'before' }, 'url');
		await mkdir(join(project.sources, 'nested'));
		const server = await createServer({
			...project.config,
			optimizeDeps: { noDiscovery: true, include: [] },
			server: { middlewareMode: true, hmr: false, preTransformRequests: false },
		});
		cleanups.push(() => server.close());
		const moduleId = 'virtual:8f4e-source-urls/programs';
		const initial = await server.transformRequest(moduleId);
		expect(initial?.code).toContain('"before.8f4e"');
		expect(initial?.code).toMatch(/[?&]url&no-inline/);
		await expect
			.poll(() => Object.values(server.watcher.getWatched()).flat().includes('before.8f4e'), { timeout: 5000 })
			.toBe(true);
		await project.write('nested/added.8f4e', 'new source');
		await expect
			.poll(async () => (await server.transformRequest(moduleId))?.code, { timeout: 5000 })
			.toContain('"nested/added.8f4e"');
		await unlink(join(project.sources, 'before.8f4e'));
		await expect
			.poll(async () => (await server.transformRequest(moduleId))?.code, { timeout: 5000 })
			.not.toContain('"before.8f4e"');
	});
});

it.each(['text', 'url'] as const)('reloads a loaded %s collection only when matching files change', async kind => {
	const project = await fixture({ 'before.test.8f4e': 'before', 'ignored/existing.test.8f4e': 'ignored' }, kind);
	const collection = kind === 'text' ? sourceFiles : sourceUrls;
	const server = await createServer({
		...project.config,
		plugins: [
			collection({
				name: 'programs',
				root: project.sources,
				include: ['**/*.test.8f4e'],
				exclude: ['ignored/**'],
			}),
		],
		optimizeDeps: { noDiscovery: true, include: [] },
		server: { middlewareMode: true, hmr: false, preTransformRequests: false },
	});
	cleanups.push(() => server.close());
	const send = vi.spyOn(server.ws, 'send');
	const sources = await realpath(project.sources);
	await expect
		.poll(() => Object.values(server.watcher.getWatched()).flat(), { timeout: 5000 })
		.toEqual(expect.arrayContaining(['before.test.8f4e', 'existing.test.8f4e']));

	async function change(event: 'add' | 'unlink', path: string, action: () => Promise<unknown>) {
		let observed = false;
		const listener = (file: string) => {
			if (resolve(file) === join(sources, path)) observed = true;
		};
		server.watcher.on(event, listener);
		try {
			await action();
			await expect.poll(() => observed, { timeout: 5000 }).toBe(true);
		} finally {
			server.watcher.off(event, listener);
		}
	}
	const add = (path: string) => change('add', path, () => project.write(path, 'new source'));
	const remove = (path: string) => change('unlink', path, () => unlink(join(project.sources, path)));
	const moduleId = `virtual:${kind === 'text' ? '8f4e-sources' : '8f4e-source-urls'}/programs`;
	const id = (name: string) => `"${name}.test${kind === 'url' ? '.8f4e' : ''}"`;

	await add('unloaded.test.8f4e');
	expect(send).not.toHaveBeenCalledWith({ type: 'full-reload' });
	expect((await server.transformRequest(moduleId))?.code).toContain(id('unloaded'));
	const module = server.environments.client.moduleGraph.getModuleById(`\0${moduleId}`)!;
	const cached = module.transformResult;
	expect(cached).not.toBeNull();

	for (const path of ['diagnostic.error.8f4e', 'ignored/new.test.8f4e']) {
		await add(path);
		await remove(path);
	}
	expect(send).not.toHaveBeenCalledWith({ type: 'full-reload' });
	expect(module.transformResult).toBe(cached);

	await add('later.test.8f4e');
	expect(send).toHaveBeenCalledWith({ type: 'full-reload' });
	expect((await server.transformRequest(moduleId))?.code).toContain(id('later'));
	send.mockClear();
	await remove('before.test.8f4e');
	expect(send).toHaveBeenCalledWith({ type: 'full-reload' });
	expect((await server.transformRequest(moduleId))?.code).not.toContain(id('before'));
});
