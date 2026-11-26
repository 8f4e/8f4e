import { realpath } from 'node:fs/promises';
import { extname, isAbsolute, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { glob } from 'tinyglobby';
import type { Plugin, ViteDevServer } from 'vite';

export interface SourceFilesOptions {
	/** Collection name used in `virtual:8f4e-sources/<name>`. */
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
	if (!/^[\w.-]+$/.test(options.name)) {
		throw new Error('Source collection names must contain only letters, numbers, underscores, dots, or hyphens.');
	}

	const pluginName = `8f4e-sources:${options.name}`;
	const publicId = `virtual:8f4e-sources/${options.name}`;
	const resolvedId = `\0${publicId}`;
	let sourceRoot: string;
	let building = false;
	let server: ViteDevServer | undefined;

	function refreshCollection(file: string): void {
		const path = relative(sourceRoot, file);
		if (!server || path === '..' || path.startsWith(`..${sep}`) || isAbsolute(path)) {
			return;
		}
		for (const environment of Object.values(server.environments)) {
			const module = environment.moduleGraph.getModuleById(resolvedId);
			if (module) {
				environment.moduleGraph.invalidateModule(module);
			}
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
			const settings = { cwd: sourceRoot, absolute: true, ignore: options.exclude, expandDirectories: false };
			const [files, directories] = await Promise.all([
				glob(options.include ?? ['**/*.8f4e'], settings),
				building ? glob('**', { ...settings, onlyDirectories: true }) : Promise.resolve([]),
			]);
			// Directory dependencies also detect new files during Rollup's build watch.
			if (building) {
				for (const path of [sourceRoot, ...directories, ...files]) {
					this.addWatchFile(path);
				}
			}

			const pathsById = new Map<string, string>();
			const entries = files.sort().map(file => {
				const path = relative(sourceRoot, file).split(sep).join('/');
				if (path === '..' || path.startsWith('../') || isAbsolute(path)) {
					throw new Error(`Source file is outside the collection root: ${file}`);
				}
				const extension = extname(path);
				const sourceId = extension ? path.slice(0, -extension.length) : path;
				const previous = pathsById.get(sourceId);
				if (previous) {
					throw new Error(`Duplicate source ID "${sourceId}": ${previous} and ${path}`);
				}
				pathsById.set(sourceId, path);
				const specifier = `${file.split(sep).join('/')}?raw`;
				return `[${JSON.stringify(sourceId)}, () => import(${JSON.stringify(specifier)}).then(m => m.default)]`;
			});
			return `export default new Map([${entries.join(',\n')}]);`;
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
