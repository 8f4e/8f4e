#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import { brotliCompress, gzip } from 'node:zlib';
import { getWorkspaceProjects } from './workspace-projects.mjs';

const gzipAsync = promisify(gzip);
const brotliCompressAsync = promisify(brotliCompress);

const workspaceRoot = process.cwd();
const defaultConfigPath = 'bundle-size.config.json';
const defaultOutputDir = 'logs/bundle-sizes';
const defaultDistDir = 'dist';

const options = parseArgs(process.argv.slice(2));

if (options.help) {
	printHelp();
	process.exit(0);
}

const bundleSizeConfig = await readBundleSizeConfig(options.configPath ?? defaultConfigPath);
const outputDir = path.resolve(workspaceRoot, options.outputDir ?? bundleSizeConfig.outDir ?? defaultOutputDir);
const packageFilter = options.packages.length > 0 ? new Set(options.packages) : null;
const gitMetadata = getGitMetadata();
const projects = await getWorkspaceProjects(workspaceRoot);
const projectsByName = new Map(projects.map(project => [project.name, project]));
const packageResults = [];
const skippedResults = [];

for (const [packageName, packageConfig] of Object.entries(bundleSizeConfig.packages)) {
	if (packageFilter && !packageFilter.has(packageName)) {
		continue;
	}

	const project = projectsByName.get(packageName);

	if (!project) {
		console.warn(`Skipping ${packageName}: no Nx workspace package found`);
		continue;
	}

	const { root: packageRoot, projectName, version } = project;

	if (await hasLoggedPackageVersion(outputDir, packageName, version)) {
		skippedResults.push({
			packageName,
			version,
		});
		continue;
	}

	const distRoot = path.resolve(packageRoot, packageConfig.distDir ?? defaultDistDir);

	if (!(await pathExists(distRoot))) {
		console.warn(`Skipping ${packageName}: no dist directory at ${path.relative(workspaceRoot, distRoot)}`);
		continue;
	}

	const bundleEntries = await resolveBundleEntries(distRoot, packageConfig.entries);
	const measuredEntries = await measureBundleEntries(bundleEntries);

	if (measuredEntries.length === 0) {
		console.warn(
			`Skipping ${packageName}: no configured bundle files matched in ${path.relative(workspaceRoot, distRoot)}`
		);
		continue;
	}

	const entry = {
		schemaVersion: 1,
		recordedAt: new Date().toISOString(),
		commit: gitMetadata.commit,
		branch: gitMetadata.branch,
		releaseTag: findReleaseTag(gitMetadata.allTags, projectName, version),
		packageName,
		projectName,
		version,
		bytes: sumFiles(measuredEntries),
	};

	await appendPackageEntry(outputDir, packageName, entry);
	packageResults.push(entry);
}

if (packageResults.length === 0) {
	if (skippedResults.length > 0) {
		console.log('No package bundle sizes were logged because all matching package versions already have entries.');
		process.exit(0);
	}

	console.error(
		'No package bundle sizes were logged. Build packages first, or pass package names that have dist output.'
	);
	process.exit(1);
}

for (const result of packageResults) {
	const logPath = getPackageLogPath(outputDir, result.packageName);
	console.log(
		[
			result.packageName,
			`${result.bytes.raw} raw bytes`,
			`${result.bytes.gzip} gzip bytes`,
			`${result.bytes.brotli} brotli bytes`,
			path.relative(workspaceRoot, logPath),
		].join(' | ')
	);
}

for (const result of skippedResults) {
	console.log([result.packageName, `version ${result.version ?? 'unknown'} already logged`, 'skipped'].join(' | '));
}

function parseArgs(args) {
	const parsed = {
		help: false,
		configPath: undefined,
		outputDir: undefined,
		packages: [],
	};

	for (let index = 0; index < args.length; index += 1) {
		const arg = args[index];

		if (arg === '--help' || arg === '-h') {
			parsed.help = true;
			continue;
		}

		if (arg === '--config') {
			const value = args[index + 1];
			if (!value) {
				throw new Error('--config requires a value');
			}
			parsed.configPath = value;
			index += 1;
			continue;
		}

		if (arg.startsWith('--config=')) {
			parsed.configPath = arg.slice('--config='.length);
			continue;
		}

		if (arg === '--out-dir') {
			const value = args[index + 1];
			if (!value) {
				throw new Error('--out-dir requires a value');
			}
			parsed.outputDir = value;
			index += 1;
			continue;
		}

		if (arg.startsWith('--out-dir=')) {
			parsed.outputDir = arg.slice('--out-dir='.length);
			continue;
		}

		if (arg === '--package') {
			const value = args[index + 1];
			if (!value) {
				throw new Error('--package requires a value');
			}
			parsed.packages.push(value);
			index += 1;
			continue;
		}

		if (arg.startsWith('--package=')) {
			parsed.packages.push(arg.slice('--package='.length));
			continue;
		}

		throw new Error(`Unknown argument: ${arg}`);
	}

	return parsed;
}

function printHelp() {
	console.log(`Usage: node tools/release/scripts/log-bundle-sizes.mjs [options]

Appends bundle-size entries to logs/bundle-sizes/{package-name}.json.

Options:
  --config <path>        Config file. Default: ${defaultConfigPath}
  --out-dir <path>       Output directory. Overrides config outDir.
  --package <name>       Only log one configured package. Can be repeated.
  -h, --help             Show this help.

Notes:
  - Packages and entry regexes are read from ${defaultConfigPath}.
  - Run package builds before this script.
  - Package outputs default to ${defaultDistDir}/; a nonstandard distDir is relative to the discovered package root.
  - File patterns match within the package output directory.
  - When a Vite manifest exists, bytes include the matched entry and its static imports.
  - Log entries contain aggregate numeric byte totals for graphing.
  - Scoped packages use their package name as a nested path, e.g. logs/bundle-sizes/@8f4e/compiler.json.`);
}

async function resolveBundleEntries(distRoot, fileRules) {
	const distFilePaths = await collectDistRuntimeFiles(distRoot);
	const viteManifest = await readViteManifest(distRoot);
	const bundleEntries = [];

	for (const rule of fileRules) {
		const pattern = new RegExp(rule.pattern);
		const matches = distFilePaths.filter(({ relativePath }) => pattern.test(relativePath));

		if (matches.length === 0) {
			console.warn(`No files matched ${rule.pattern} in ${path.relative(workspaceRoot, distRoot)}`);
			continue;
		}

		if (matches.length > 1) {
			throw new Error(
				`Pattern ${rule.pattern} in ${path.relative(workspaceRoot, distRoot)} matched multiple files: ${matches
					.map(match => match.relativePath)
					.join(', ')}`
			);
		}

		const staticFiles = resolveStaticBundleFiles(matches[0], viteManifest, distRoot);

		bundleEntries.push({
			name: rule.name,
			filePaths: staticFiles.map(({ filePath }) => filePath),
		});
	}

	return bundleEntries.sort((a, b) => a.name.localeCompare(b.name));
}

async function readViteManifest(distRoot) {
	const manifestPath = path.join(distRoot, '.vite', 'manifest.json');

	if (!(await pathExists(manifestPath))) {
		console.warn(
			`No Vite manifest found at ${path.relative(workspaceRoot, manifestPath)}; measuring matched entry files only.`
		);
		return null;
	}

	return readJson(manifestPath);
}

function resolveStaticBundleFiles(entryFile, manifest, distRoot) {
	if (!manifest) {
		return [entryFile];
	}

	const entryChunk = Object.values(manifest).find(chunk => chunk?.file === entryFile.relativePath);

	if (!entryChunk) {
		console.warn(
			`No Vite manifest chunk found for ${entryFile.relativePath} in ${path.relative(workspaceRoot, distRoot)}; measuring matched entry file only.`
		);
		return [entryFile];
	}

	const filesByRelativePath = new Map();
	const chunksByKey = new Map(Object.entries(manifest));
	const visitedChunkKeys = new Set();
	const staticFiles = [];

	function addChunk(chunkKey, chunk) {
		if (!chunk || visitedChunkKeys.has(chunkKey)) {
			return;
		}

		visitedChunkKeys.add(chunkKey);

		if (typeof chunk.file === 'string' && isRuntimeFile(chunk.file)) {
			filesByRelativePath.set(chunk.file, {
				relativePath: chunk.file,
				filePath: path.join(distRoot, chunk.file),
			});
		}

		for (const importKey of chunk.imports ?? []) {
			addChunk(importKey, chunksByKey.get(importKey));
		}
	}

	for (const [chunkKey, chunk] of chunksByKey) {
		if (chunk === entryChunk) {
			addChunk(chunkKey, chunk);
			break;
		}
	}

	for (const file of [...filesByRelativePath.values()].sort((a, b) => a.relativePath.localeCompare(b.relativePath))) {
		staticFiles.push(file);
	}

	return staticFiles.length > 0 ? staticFiles : [entryFile];
}

async function collectDistRuntimeFiles(distRoot) {
	const files = [];
	await collectRuntimeFiles(distRoot, distRoot, files);
	return files;
}

async function collectRuntimeFiles(root, dir, files) {
	const entries = await fs.readdir(dir, { withFileTypes: true });

	for (const entry of entries) {
		const entryPath = path.join(dir, entry.name);

		if (entry.isDirectory()) {
			await collectRuntimeFiles(root, entryPath, files);
			continue;
		}

		if (!entry.isFile()) {
			continue;
		}

		const relativePath = path.relative(root, entryPath).split(path.sep).join('/');

		if (isRuntimeFile(relativePath)) {
			files.push({ relativePath, filePath: entryPath });
		}
	}
}

async function measureBundleEntries(bundleEntries) {
	const entries = [];

	for (const { name, filePaths } of bundleEntries) {
		const measuredFiles = await Promise.all(filePaths.map(measureFile));
		const bytes = sumFiles(measuredFiles);

		entries.push({
			path: name,
			raw: bytes.raw,
			gzip: bytes.gzip,
			brotli: bytes.brotli,
		});
	}

	return entries.sort((a, b) => a.path.localeCompare(b.path));
}

async function measureFile(filePath) {
	const bytes = await fs.readFile(filePath);
	const gzipBytes = await gzipAsync(bytes);
	const brotliBytes = await brotliCompressAsync(bytes);

	return {
		path: filePath,
		raw: bytes.byteLength,
		gzip: gzipBytes.byteLength,
		brotli: brotliBytes.byteLength,
	};
}

function isRuntimeFile(fileName) {
	if (fileName.endsWith('.map') || fileName.endsWith('.d.ts')) {
		return false;
	}

	return true;
}

function sumFiles(files) {
	return files.reduce(
		(totals, file) => ({
			raw: totals.raw + file.raw,
			gzip: totals.gzip + file.gzip,
			brotli: totals.brotli + file.brotli,
		}),
		{
			raw: 0,
			gzip: 0,
			brotli: 0,
		}
	);
}

async function appendPackageEntry(outputRoot, packageName, entry) {
	const logPath = getPackageLogPath(outputRoot, packageName);
	await fs.mkdir(path.dirname(logPath), { recursive: true });

	const existingEntries = (await pathExists(logPath)) ? await readJson(logPath) : [];

	if (!Array.isArray(existingEntries)) {
		throw new Error(`${path.relative(workspaceRoot, logPath)} must contain a JSON array`);
	}

	existingEntries.push(entry);
	await fs.writeFile(logPath, `${JSON.stringify(existingEntries, null, '\t')}\n`);
}

async function hasLoggedPackageVersion(outputRoot, packageName, version) {
	if (!version) {
		return false;
	}

	const logPath = getPackageLogPath(outputRoot, packageName);

	if (!(await pathExists(logPath))) {
		return false;
	}

	const existingEntries = await readJson(logPath);

	if (!Array.isArray(existingEntries)) {
		throw new Error(`${path.relative(workspaceRoot, logPath)} must contain a JSON array`);
	}

	const latestEntry = existingEntries.at(-1);
	return latestEntry?.version === version;
}

function getPackageLogPath(outputRoot, packageName) {
	const pathSegments = packageName.split('/').map(segment => {
		if (!segment || segment === '.' || segment === '..') {
			throw new Error(`Invalid package name segment in ${packageName}`);
		}
		return segment;
	});
	const fileName = `${pathSegments.pop()}.json`;
	return path.join(outputRoot, ...pathSegments, fileName);
}

function findReleaseTag(tags, projectName, version) {
	if (!version) {
		return null;
	}

	const expectedTag = `${projectName}@${version}`;
	return tags.includes(expectedTag) ? expectedTag : null;
}

function getGitMetadata() {
	return {
		commit: runGit(['rev-parse', 'HEAD']),
		branch: runGit(['branch', '--show-current']),
		allTags: runGit(['tag', '--list'])
			.split('\n')
			.map(tag => tag.trim())
			.filter(Boolean)
			.sort(),
	};
}

function runGit(args) {
	try {
		return execFileSync('git', args, {
			cwd: workspaceRoot,
			encoding: 'utf8',
			stdio: ['ignore', 'pipe', 'ignore'],
		}).trim();
	} catch {
		return '';
	}
}

async function readBundleSizeConfig(configPath) {
	const resolvedConfigPath = path.resolve(workspaceRoot, configPath);
	const config = await readJson(resolvedConfigPath);

	if (!config || typeof config !== 'object' || Array.isArray(config)) {
		throw new Error(`${configPath} must contain an object`);
	}

	if (!config.packages || typeof config.packages !== 'object') {
		throw new Error(`${configPath} must define a packages object`);
	}

	for (const [packageName, packageConfig] of Object.entries(config.packages)) {
		if (!packageConfig || typeof packageConfig !== 'object') {
			throw new Error(`${configPath}: ${packageName} must contain an object`);
		}

		const distDir = packageConfig.distDir === undefined ? defaultDistDir : packageConfig.distDir;
		if (typeof distDir !== 'string' || !distDir || path.isAbsolute(distDir) || distDir.split(/[\\/]/).includes('..')) {
			throw new Error(`${configPath}: ${packageName}.distDir must be a package-relative path`);
		}

		if (!Array.isArray(packageConfig.entries) || packageConfig.entries.length === 0) {
			throw new Error(`${configPath}: ${packageName}.entries must be a non-empty array`);
		}

		for (const entryRule of packageConfig.entries) {
			if (!entryRule || typeof entryRule !== 'object') {
				throw new Error(`${configPath}: ${packageName}.entries entries must be objects`);
			}

			if (typeof entryRule.name !== 'string' || !entryRule.name) {
				throw new Error(`${configPath}: ${packageName}.entries[].name must be a string`);
			}

			if (typeof entryRule.pattern !== 'string' || !entryRule.pattern) {
				throw new Error(`${configPath}: ${packageName}.entries[].pattern must be a string`);
			}

			new RegExp(entryRule.pattern);
		}
	}

	return config;
}

async function readJson(filePath) {
	return JSON.parse(await fs.readFile(filePath, 'utf8'));
}

async function pathExists(filePath) {
	try {
		await fs.access(filePath);
		return true;
	} catch {
		return false;
	}
}
