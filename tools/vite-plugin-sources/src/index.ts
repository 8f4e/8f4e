import { realpath } from 'node:fs/promises';
import { extname, isAbsolute, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { glob, globSync } from 'tinyglobby';
import type { Plugin, ViteDevServer } from 'vite';

export interface SourceFilesOptions {
	/** Collection name used in the virtual module ID. */
	name: string;
	/** Source directory. Relative paths resolve against Vite's root. */
	root: string | URL;
	/** Patterns relative to the source directory. Defaults to all .8f4e files. */
	include?: string[];
	/** Patterns to exclude, relative to the source directory. */
	exclude?: string[];
}

/** Expose a discovered collection as an ID-to-lazy-source-loader map. */
export function sourceFiles(options: SourceFilesOptions): Plugin {
	return sourceCollection(options, 'text');
}

/** Expose a discovered collection as a relative-path-to-external-asset-URL map. */
export function sourceUrls(options: SourceFilesOptions): Plugin {
	return sourceCollection(options, 'url');
}

function sourceCollection(options: SourceFilesOptions, kind: 'text' | 'url'): Plugin {
	if (!/^[\w.-]+$/.test(options.name)) {
		throw new Error('Source collection names must contain only letters, numbers, underscores, dots, or hyphens.');
	}

	const namespace = kind === 'text' ? '8f4e-sources' : '8f4e-source-urls';
	const pluginName = `${namespace}:${options.name}`;
	const publicId = `virtual:${namespace}/${options.name}`;
	const resolvedId = `\0${publicId}`;
	const include = options.include ?? ['**/*.8f4e'];
	let sourceRoot: string;
	let building = false;
	let server: ViteDevServer | undefined;
	let knownFiles: Set<string> | undefined;

	function discoverySettings() {
		return { cwd: sourceRoot, absolute: true, ignore: options.exclude, expandDirectories: false };
	}

	function refreshCollection(file: string): void {
		const path = relative(sourceRoot, file);
		const previousFiles = knownFiles;
		if (!server || !previousFiles || path === '..' || path.startsWith(`..${sep}`) || isAbsolute(path)) {
			return;
		}
		const loaded = Object.values(server.environments).flatMap(environment => {
			const module = environment.moduleGraph.getModuleById(resolvedId);
			return module ? [{ graph: environment.moduleGraph, module }] : [];
		});
		if (loaded.length === 0) return;

		// Use the same discovery rules as load, including exclusions and negated patterns.
		const files = globSync(include, discoverySettings());
		if (files.length === previousFiles.size && files.every(file => previousFiles.has(file))) return;
		knownFiles = new Set(files);
		for (const { graph, module } of loaded) {
			graph.invalidateModule(module);
		}
		server.ws.send({ type: 'full-reload' });
	}

	return {
		name: pluginName,
		async configResolved(config) {
			if (config.plugins.filter(plugin => plugin.name === pluginName).length > 1) {
				throw new Error(`Duplicate source collection: ${options.name}`);
			}
			sourceRoot = await realpath(
				resolve(config.root, typeof options.root === 'string' ? options.root : fileURLToPath(options.root))
			);
			building = config.command === 'build';
		},
		resolveId(id) {
			if (id === publicId) {
				return resolvedId;
			}
		},
		async load(id) {
			if (id !== resolvedId) {
				return null;
			}
			const settings = discoverySettings();
			const [files, directories] = await Promise.all([
				glob(include, settings),
				building ? glob('**', { ...settings, onlyDirectories: true }) : Promise.resolve([]),
			]);
			// Directory dependencies also detect new files during Rollup's build watch.
			if (building) {
				for (const path of [sourceRoot, ...directories, ...files]) {
					this.addWatchFile(path);
				}
			}

			const pathsById = new Map<string, string>();
			const imports: string[] = [];
			const entries = files.sort().map((file, index) => {
				const path = relative(sourceRoot, file).split(sep).join('/');
				if (path === '..' || path.startsWith('../') || isAbsolute(path)) {
					throw new Error(`Source file is outside the collection root: ${file}`);
				}
				const extension = extname(path);
				const sourceId = kind === 'text' && extension ? path.slice(0, -extension.length) : path;
				const previous = pathsById.get(sourceId);
				if (previous) {
					throw new Error(`Duplicate source ID "${sourceId}": ${previous} and ${path}`);
				}
				pathsById.set(sourceId, path);
				const specifier = file.split(sep).join('/');
				if (kind === 'url') {
					const variable = `url${index}`;
					imports.push(`import ${variable} from ${JSON.stringify(`${specifier}?url&no-inline`)};`);
					return `[${JSON.stringify(sourceId)}, ${variable}]`;
				}
				return `[${JSON.stringify(sourceId)}, () => import(${JSON.stringify(`${specifier}?raw`)}).then(m => m.default)]`;
			});
			knownFiles = new Set(files);
			return [...imports, `export default new Map([${entries.join(',\n')}]);`].join('\n');
		},
		configureServer(devServer) {
			server = devServer;
			if (!server.config.server.fs.allow.includes(sourceRoot)) {
				server.config.server.fs.allow.push(sourceRoot);
			}
			server.watcher.add(sourceRoot);
			server.watcher.on('add', refreshCollection);
			server.watcher.on('unlink', refreshCollection);
		},
		closeBundle() {
			server?.watcher.off('add', refreshCollection);
			server?.watcher.off('unlink', refreshCollection);
		},
	};
}
