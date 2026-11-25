#!/usr/bin/env node
/* global console, process */

import { execFileSync } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';

const workspaceRoot = process.cwd();
const projectRoots = ['packages', 'apps'].map(directory => path.resolve(workspaceRoot, directory));
const outputDir = path.resolve(workspaceRoot, 'logs/test-coverage');
const suiteName = 'test-coverage';

const ignoredDirectories = new Set(['.tmp', 'coverage', 'dist', 'node_modules']);
const ignoredPackages = new Set(['glugglugglug']);
const excludedSourceFilePatterns = [/\.d\.ts$/, /\.test\.ts$/, /\.spec\.ts$/];
const coverageMetrics = ['statements', 'branches', 'functions', 'lines'];

await main();

async function main() {
	const packageEntries = (await Promise.all(getPackageRoots().map(collectPackageEntries))).flat();
	const commit = getGitCommit();
	const recordedAt = new Date().toISOString();
	const loggedEntries = [];
	const skippedEntries = [];
	let loggedCoverageSummaryCount = 0;

	for (const packageEntry of packageEntries) {
		const coverageSummaryPath = await findCoverageSummaryPath(packageEntry);

		if (!coverageSummaryPath) {
			if (
				!packageEntry.hasTestTarget &&
				packageEntry.sourceRoot &&
				!(await hasMeasuredTypeScriptFiles(packageEntry.sourceRoot))
			) {
				const coverage = createEmptyCoverageResult();
				const logEntry = {
					commit,
					recordedAt,
					coverage,
				};
				const outputPath = getPackageLogPath(packageEntry);

				await appendLogEntry(outputPath, logEntry);
				loggedEntries.push({
					...logEntry,
					packageName: packageEntry.name,
					outputPath,
				});
				continue;
			}

			skippedEntries.push({
				...packageEntry,
				reason: 'no coverage summary',
			});
			continue;
		}

		const summary = await readJson(coverageSummaryPath);
		const coverage = toCoverageResult(summary.total);
		loggedCoverageSummaryCount += 1;
		const logEntry = {
			commit,
			recordedAt,
			coverage,
		};
		const outputPath = getPackageLogPath(packageEntry);

		await appendLogEntry(outputPath, logEntry);
		loggedEntries.push({
			...logEntry,
			packageName: packageEntry.name,
			outputPath,
		});
	}

	if (loggedCoverageSummaryCount === 0) {
		console.error('No test coverage summaries were found. Run tests with --coverage before logging.');
		process.exit(1);
	}

	printResults(loggedEntries, skippedEntries);
}

function getPackageRoots() {
	const packageRootArgs = getArgValues('--package-root');

	if (packageRootArgs.length === 0) {
		return projectRoots;
	}

	return packageRootArgs.map(packageRoot => path.resolve(workspaceRoot, packageRoot));
}

function getArgValues(name) {
	const values = [];

	for (let index = 2; index < process.argv.length; index += 1) {
		const arg = process.argv[index];

		if (arg === name) {
			const value = process.argv[index + 1];

			if (!value) {
				throw new Error(`${name} requires a value`);
			}

			values.push(value);
			index += 1;
			continue;
		}

		if (arg.startsWith(`${name}=`)) {
			values.push(arg.slice(name.length + 1));
		}
	}

	return values;
}

async function collectPackageEntries(root) {
	const projectJsonPaths = [];
	await collectProjectJsonPaths(root, projectJsonPaths);

	const packageEntries = [];

	for (const projectJsonPath of projectJsonPaths.sort()) {
		const packageRoot = path.dirname(projectJsonPath);
		const packageJsonPath = path.join(packageRoot, 'package.json');

		if (!(await pathExists(packageJsonPath))) {
			continue;
		}

		const [projectJson, packageJson] = await Promise.all([readJson(projectJsonPath), readJson(packageJsonPath)]);

		if (!packageJson.name || ignoredPackages.has(packageJson.name)) {
			continue;
		}

		const sourceRoot = await resolveSourceRoot(packageRoot, projectJson);

		packageEntries.push({
			name: packageJson.name,
			root: packageRoot,
			relativeRoot: toWorkspacePath(packageRoot),
			hasTestTarget: Boolean(projectJson.targets?.test),
			sourceRoot,
		});
	}

	return packageEntries;
}

async function collectProjectJsonPaths(dir, projectJsonPaths) {
	const entries = await fs.readdir(dir, { withFileTypes: true });

	for (const entry of entries) {
		const entryPath = path.join(dir, entry.name);

		if (entry.isDirectory()) {
			if (!ignoredDirectories.has(entry.name)) {
				await collectProjectJsonPaths(entryPath, projectJsonPaths);
			}

			continue;
		}

		if (entry.isFile() && entry.name === 'project.json') {
			projectJsonPaths.push(entryPath);
		}
	}
}

async function resolveSourceRoot(packageRoot, projectJson) {
	const packageRelativeSourceRoot = path.join(packageRoot, 'src');
	const configuredSourceRoot = projectJson.sourceRoot;

	if (!configuredSourceRoot) {
		return (await pathExists(packageRelativeSourceRoot)) ? packageRelativeSourceRoot : null;
	}

	const sourceRootIsWorkspaceRelative =
		configuredSourceRoot === 'packages' || configuredSourceRoot.startsWith('packages/');
	const workspaceRelativeSourceRoot = sourceRootIsWorkspaceRelative
		? path.resolve(workspaceRoot, configuredSourceRoot)
		: null;

	if (workspaceRelativeSourceRoot && (await pathExists(workspaceRelativeSourceRoot))) {
		return workspaceRelativeSourceRoot;
	}

	const localSourceRoot = path.resolve(packageRoot, configuredSourceRoot);

	return (await pathExists(localSourceRoot)) ? localSourceRoot : null;
}

async function findCoverageSummaryPath(packageEntry) {
	const packageNameCoveragePath = path.join(workspaceRoot, 'coverage', packageEntry.name, 'coverage-summary.json');
	const workspaceCoveragePath = path.join(
		workspaceRoot,
		'coverage',
		packageEntry.relativeRoot,
		'coverage-summary.json'
	);
	const packageCoveragePath = path.join(packageEntry.root, 'coverage', 'coverage-summary.json');

	if (await pathExists(packageNameCoveragePath)) {
		return packageNameCoveragePath;
	}

	if (await pathExists(workspaceCoveragePath)) {
		return workspaceCoveragePath;
	}

	return (await pathExists(packageCoveragePath)) ? packageCoveragePath : null;
}

async function hasMeasuredTypeScriptFiles(root) {
	const entries = await fs.readdir(root, { withFileTypes: true });

	for (const entry of entries) {
		const entryPath = path.join(root, entry.name);

		if (entry.isDirectory()) {
			if (!ignoredDirectories.has(entry.name) && (await hasMeasuredTypeScriptFiles(entryPath))) {
				return true;
			}

			continue;
		}

		if (entry.isFile() && shouldMeasureSourceFile(entryPath)) {
			return true;
		}
	}

	return false;
}

function shouldMeasureSourceFile(filePath) {
	return filePath.endsWith('.ts') && !excludedSourceFilePatterns.some(pattern => pattern.test(filePath));
}

function toCoverageResult(total) {
	return Object.fromEntries(
		coverageMetrics.map(metric => {
			const summary = total?.[metric];

			if (!summary) {
				throw new Error(`Coverage summary is missing ${metric}`);
			}

			return [
				metric,
				{
					covered: summary.covered,
					total: summary.total,
					percentage: toCoveragePercentage(summary),
				},
			];
		})
	);
}

function createEmptyCoverageResult() {
	return Object.fromEntries(
		coverageMetrics.map(metric => [
			metric,
			{
				covered: 0,
				total: 0,
				percentage: 100,
			},
		])
	);
}

function toCoveragePercentage(summary) {
	if (typeof summary.pct === 'number') {
		return summary.pct;
	}

	return toPercentage(summary.covered, summary.total);
}

function getPackageLogPath(packageEntry) {
	return path.join(outputDir, `${packageEntry.name}.json`);
}

async function appendLogEntry(filePath, entry) {
	await fs.mkdir(path.dirname(filePath), { recursive: true });

	const existingEntries = (await pathExists(filePath)) ? await readJson(filePath) : [];

	if (!Array.isArray(existingEntries)) {
		throw new Error(`${toWorkspacePath(filePath)} must contain a JSON array`);
	}

	existingEntries.push(entry);
	await fs.writeFile(filePath, `${JSON.stringify(existingEntries, null, '\t')}\n`);
}

function printResults(loggedEntries, skippedEntries) {
	const totals = loggedEntries.reduce(
		(summary, entry) => ({
			covered: summary.covered + entry.coverage.lines.covered,
			total: summary.total + entry.coverage.lines.total,
		}),
		{ covered: 0, total: 0 }
	);
	const linePercentage = toPercentage(totals.covered, totals.total);

	console.log(
		[
			suiteName,
			`${loggedEntries.length} packages`,
			`${totals.covered}/${totals.total} lines covered`,
			`${linePercentage}%`,
			toWorkspacePath(outputDir),
		].join(' | ')
	);

	for (const entry of loggedEntries) {
		console.log(
			[
				entry.packageName,
				`${entry.coverage.lines.covered}/${entry.coverage.lines.total} lines covered`,
				`${entry.coverage.lines.percentage}%`,
				toWorkspacePath(entry.outputPath),
			].join(' | ')
		);
	}

	for (const entry of skippedEntries) {
		console.log([entry.name, entry.reason, 'skipped'].join(' | '));
	}
}

function toPercentage(covered, total) {
	if (total === 0) {
		return 100;
	}

	return Number(((covered / total) * 100).toFixed(1));
}

function getGitCommit() {
	return runGit(['rev-parse', 'HEAD']);
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

function toWorkspacePath(filePath) {
	return path.relative(workspaceRoot, filePath).split(path.sep).join('/');
}
