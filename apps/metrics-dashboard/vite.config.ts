import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { defineConfig, type Plugin } from 'vite';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const workspaceRoot = path.resolve(__dirname, '../..');
const configPath = path.join(workspaceRoot, 'bundle-size.config.json');

type BundleSizeConfig = {
	outDir?: string;
	packages: Record<
		string,
		{
			label?: string;
		}
	>;
};

export default defineConfig({
	plugins: [metricsLogsPlugin()],
	build: {
		outDir: 'dist',
		emptyOutDir: true,
	},
	server: {
		port: 3001,
	},
	preview: {
		port: 3001,
	},
});

function metricsLogsPlugin(): Plugin {
	return {
		name: 'metrics-logs',
		configureServer(server) {
			server.middlewares.use(async (request, response, next) => {
				if (
					!request.url?.startsWith('/bundle-sizes/') &&
					!request.url?.startsWith('/bytecode-size/') &&
					!request.url?.startsWith('/compiler-coverage-counts/') &&
					!request.url?.startsWith('/tsdoc-coverage/') &&
					!request.url?.startsWith('/test-coverage/')
				) {
					next();
					return;
				}

				try {
					const url = new URL(request.url, 'http://localhost');
					const content = await readMetricsAsset(url.pathname);

					response.statusCode = 200;
					response.setHeader('Content-Type', 'application/json; charset=utf-8');
					response.end(content);
				} catch (error) {
					if (isFileNotFoundError(error)) {
						response.statusCode = 404;
						response.end('Not found');
						return;
					}

					next(error);
				}
			});
		},
		async generateBundle() {
			const config = await readBundleSizeConfig();
			const manifest = createManifest(config);
			const bytecodeManifest = await createBytecodeManifest();
			const compilerCoverageManifest = await createCompilerCoverageManifest();
			const tsdocCoverageManifest = await createTsdocCoverageManifest();
			const testCoverageManifest = await createTestCoverageManifest();

			this.emitFile({
				type: 'asset',
				fileName: 'bundle-sizes/manifest.json',
				source: JSON.stringify(manifest, null, '\t'),
			});

			for (const log of manifest.logs) {
				const content = await fs.readFile(getLogFilePath(config, log.path), 'utf8');
				this.emitFile({
					type: 'asset',
					fileName: `bundle-sizes/${log.path}`,
					source: content,
				});
			}

			this.emitFile({
				type: 'asset',
				fileName: 'bytecode-size/manifest.json',
				source: JSON.stringify(bytecodeManifest, null, '\t'),
			});

			for (const log of bytecodeManifest.logs) {
				const content = await fs.readFile(getBytecodeLogFilePath(log.path), 'utf8');
				this.emitFile({
					type: 'asset',
					fileName: `bytecode-size/${log.path}`,
					source: content,
				});
			}

			this.emitFile({
				type: 'asset',
				fileName: 'compiler-coverage-counts/manifest.json',
				source: JSON.stringify(compilerCoverageManifest, null, '\t'),
			});

			for (const log of compilerCoverageManifest.logs) {
				const content = await fs.readFile(getCompilerCoverageLogFilePath(log.path), 'utf8');
				this.emitFile({
					type: 'asset',
					fileName: `compiler-coverage-counts/${log.path}`,
					source: content,
				});
			}

			this.emitFile({
				type: 'asset',
				fileName: 'tsdoc-coverage/manifest.json',
				source: JSON.stringify(tsdocCoverageManifest, null, '\t'),
			});

			for (const log of tsdocCoverageManifest.logs) {
				const content = await fs.readFile(getTsdocCoverageLogFilePath(log.path), 'utf8');
				this.emitFile({
					type: 'asset',
					fileName: `tsdoc-coverage/${log.path}`,
					source: content,
				});
			}

			this.emitFile({
				type: 'asset',
				fileName: 'test-coverage/manifest.json',
				source: JSON.stringify(testCoverageManifest, null, '\t'),
			});

			for (const log of testCoverageManifest.logs) {
				const content = await fs.readFile(getTestCoverageLogFilePath(log.path), 'utf8');
				this.emitFile({
					type: 'asset',
					fileName: `test-coverage/${log.path}`,
					source: content,
				});
			}
		},
	};
}

async function readMetricsAsset(pathname: string) {
	if (pathname.startsWith('/bundle-sizes/')) {
		const relativePath = decodeURIComponent(pathname.slice('/bundle-sizes/'.length));
		const config = await readBundleSizeConfig();
		return relativePath === 'manifest.json'
			? JSON.stringify(createManifest(config), null, '\t')
			: await fs.readFile(getLogFilePath(config, relativePath), 'utf8');
	}

	if (pathname.startsWith('/bytecode-size/')) {
		const relativePath = decodeURIComponent(pathname.slice('/bytecode-size/'.length));
		return relativePath === 'manifest.json'
			? JSON.stringify(await createBytecodeManifest(), null, '\t')
			: await fs.readFile(getBytecodeLogFilePath(relativePath), 'utf8');
	}

	if (pathname.startsWith('/tsdoc-coverage/')) {
		const relativePath = decodeURIComponent(pathname.slice('/tsdoc-coverage/'.length));
		return relativePath === 'manifest.json'
			? JSON.stringify(await createTsdocCoverageManifest(), null, '\t')
			: await fs.readFile(getTsdocCoverageLogFilePath(relativePath), 'utf8');
	}

	if (pathname.startsWith('/test-coverage/')) {
		const relativePath = decodeURIComponent(pathname.slice('/test-coverage/'.length));
		return relativePath === 'manifest.json'
			? JSON.stringify(await createTestCoverageManifest(), null, '\t')
			: await fs.readFile(getTestCoverageLogFilePath(relativePath), 'utf8');
	}

	const compilerCoverageRelativePath = decodeURIComponent(pathname.slice('/compiler-coverage-counts/'.length));
	return compilerCoverageRelativePath === 'manifest.json'
		? JSON.stringify(await createCompilerCoverageManifest(), null, '\t')
		: await fs.readFile(getCompilerCoverageLogFilePath(compilerCoverageRelativePath), 'utf8');
}

function isFileNotFoundError(error: unknown) {
	return typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT';
}

async function readBundleSizeConfig(): Promise<BundleSizeConfig> {
	return JSON.parse(await fs.readFile(configPath, 'utf8')) as BundleSizeConfig;
}

function createManifest(config: BundleSizeConfig) {
	return {
		logs: Object.entries(config.packages).map(([packageName, packageConfig]) => ({
			packageName,
			label: packageConfig.label ?? packageName,
			path: getPackageLogRelativePath(packageName),
		})),
	};
}

async function createBytecodeManifest() {
	const logsRoot = getBytecodeLogsRoot();
	return createBenchmarkManifest(logsRoot);
}

async function createCompilerCoverageManifest() {
	const logsRoot = getCompilerCoverageLogsRoot();
	return createBenchmarkManifest(logsRoot);
}

async function createTsdocCoverageManifest() {
	const logsRoot = getTsdocCoverageLogsRoot();
	return createPackageCoverageManifest(logsRoot);
}

async function createTestCoverageManifest() {
	const logsRoot = getTestCoverageLogsRoot();
	return createPackageCoverageManifest(logsRoot);
}

async function createPackageCoverageManifest(logsRoot: string) {
	const files = await collectJsonFiles(logsRoot, logsRoot);

	return {
		logs: files.map(filePath => {
			const relativePath = path.relative(logsRoot, filePath).split(path.sep).join('/');
			const packageName = relativePath.replace(/\.json$/, '');

			return {
				packageName,
				label: packageName,
				path: relativePath,
			};
		}),
	};
}

async function createBenchmarkManifest(logsRoot: string) {
	const files = await collectJsonFiles(logsRoot, logsRoot);

	return {
		logs: files.map(filePath => {
			const relativePath = path.relative(logsRoot, filePath).split(path.sep).join('/');
			const benchmark = relativePath.replace(/\.json$/, '');
			const labelSource = path.basename(relativePath, '.json');

			return {
				benchmark,
				label: splitCamelCase(labelSource),
				path: relativePath,
			};
		}),
	};
}

async function collectJsonFiles(root: string, dir: string): Promise<string[]> {
	const entries = await fs.readdir(dir, { withFileTypes: true });
	const files = await Promise.all(
		entries.map(async entry => {
			const entryPath = path.join(dir, entry.name);

			if (entry.isDirectory()) {
				return collectJsonFiles(root, entryPath);
			}

			return entry.isFile() && entry.name.endsWith('.json') ? [entryPath] : [];
		})
	);

	return files.flat().sort((left, right) => path.relative(root, left).localeCompare(path.relative(root, right)));
}

function getLogFilePath(config: BundleSizeConfig, relativePath: string) {
	const logsRoot = path.resolve(workspaceRoot, config.outDir ?? 'logs/bundle-sizes');
	const filePath = path.resolve(logsRoot, relativePath);
	const relativeToLogsRoot = path.relative(logsRoot, filePath);

	if (relativeToLogsRoot.startsWith('..') || path.isAbsolute(relativeToLogsRoot)) {
		throw new Error(`Invalid bundle-size log path: ${relativePath}`);
	}

	return filePath;
}

function getBytecodeLogFilePath(relativePath: string) {
	const logsRoot = getBytecodeLogsRoot();
	return getMetricsLogFilePath(logsRoot, relativePath, 'bytecode-size');
}

function getCompilerCoverageLogFilePath(relativePath: string) {
	const logsRoot = getCompilerCoverageLogsRoot();
	return getMetricsLogFilePath(logsRoot, relativePath, 'compiler-coverage-counts');
}

function getTsdocCoverageLogFilePath(relativePath: string) {
	const logsRoot = getTsdocCoverageLogsRoot();
	return getMetricsLogFilePath(logsRoot, relativePath, 'tsdoc-coverage');
}

function getTestCoverageLogFilePath(relativePath: string) {
	const logsRoot = getTestCoverageLogsRoot();
	return getMetricsLogFilePath(logsRoot, relativePath, 'test-coverage');
}

function getMetricsLogFilePath(logsRoot: string, relativePath: string, logType: string) {
	const filePath = path.resolve(logsRoot, relativePath);
	const relativeToLogsRoot = path.relative(logsRoot, filePath);

	if (relativeToLogsRoot.startsWith('..') || path.isAbsolute(relativeToLogsRoot)) {
		throw new Error(`Invalid ${logType} log path: ${relativePath}`);
	}

	return filePath;
}

function getBytecodeLogsRoot() {
	return path.resolve(workspaceRoot, 'logs/bytecode-size');
}

function getCompilerCoverageLogsRoot() {
	return path.resolve(workspaceRoot, 'logs/compiler-coverage-counts');
}

function getTsdocCoverageLogsRoot() {
	return path.resolve(workspaceRoot, 'logs/tsdoc-coverage');
}

function getTestCoverageLogsRoot() {
	return path.resolve(workspaceRoot, 'logs/test-coverage');
}

function getPackageLogRelativePath(packageName: string) {
	const pathSegments = packageName.split('/');
	const fileName = `${pathSegments.pop()}.json`;
	return path
		.join(...pathSegments, fileName)
		.split(path.sep)
		.join('/');
}

function splitCamelCase(value: string) {
	return value.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/^./, character => character.toUpperCase());
}
