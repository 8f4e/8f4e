#!/usr/bin/env node
/* global console, process */

import { execFileSync } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { getOptionValues, getWorkspaceProjects } from './workspace-projects.mjs';

const workspaceRoot = process.cwd();
const args = process.argv.slice(2);
const outputDir = path.resolve(workspaceRoot, getOptionValues(args, '--out-dir').at(-1) ?? 'logs/test-coverage');
const suiteName = 'test-coverage';

const ignoredDirectories = new Set([
	'.tmp',
	'coverage',
	'dist',
	'node_modules',
	'__tests__',
	'__snapshots__',
	'__screenshots__',
	'generated',
]);
const ignoredPackages = new Set(['glugglugglug']);
const sourceExtension = /\.(?:[cm]?[jt]s|[jt]sx)$/;
const excludedSourceFile = /\.(?:test|spec|d)\.(?:[cm]?[jt]s|[jt]sx)$/;
const coverageMetrics = ['statements', 'branches', 'functions', 'lines'];
const measurementScope = 'production-source';

await main();

async function main() {
	const projects = await getWorkspaceProjects(workspaceRoot, getOptionValues(args, '--package-root'));
	const packageEntries = projects.filter(project => !ignoredPackages.has(project.name));
	const commit = getGitCommit();
	const recordedAt = new Date().toISOString();
	const measurements = [];
	const skippedEntries = [];
	const missingReports = [];
	let loggedCoverageSummaryCount = 0;

	for (const packageEntry of packageEntries) {
		if (!packageEntry.expectsCoverage) {
			if (
				!packageEntry.hasTestTarget &&
				packageEntry.sourceRoot &&
				!(await hasMeasuredSourceFiles(packageEntry.sourceRoot))
			) {
				measurements.push({ packageEntry, coverage: createEmptyCoverageResult() });
				continue;
			}

			skippedEntries.push({
				...packageEntry,
				reason: 'no coverage-producing test target',
			});
			continue;
		}

		const coverageSummaryPath = path.join(packageEntry.root, 'coverage', 'coverage-summary.json');
		let summary;
		try {
			summary = await readJson(coverageSummaryPath);
		} catch (error) {
			if (error.code !== 'ENOENT') throw error;
			missingReports.push(`${packageEntry.name}: ${toWorkspacePath(coverageSummaryPath)}`);
			continue;
		}
		measurements.push({ packageEntry, coverage: toCoverageResult(summary.total) });
		loggedCoverageSummaryCount += 1;
	}

	// Validate every expected report before writing any history entries.
	if (missingReports.length > 0) {
		throw new Error(
			`Missing expected coverage reports. Run tests with --coverage before logging.\n${missingReports.join('\n')}`
		);
	}
	if (loggedCoverageSummaryCount === 0) {
		throw new Error('No test coverage summaries were found. Run tests with --coverage before logging.');
	}

	const loggedEntries = [];
	for (const { packageEntry, coverage } of measurements) {
		const logEntry = {
			commit,
			recordedAt,
			measurementScope,
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

	printResults(loggedEntries, skippedEntries);
}

async function hasMeasuredSourceFiles(root, sourceRoot = root) {
	const entries = await fs.readdir(root, { withFileTypes: true });

	for (const entry of entries) {
		const entryPath = path.join(root, entry.name);

		if (entry.isDirectory()) {
			if (
				!ignoredDirectories.has(entry.name) &&
				entryPath !== path.join(sourceRoot, 'fixtures') &&
				(await hasMeasuredSourceFiles(entryPath, sourceRoot))
			) {
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
	return sourceExtension.test(filePath) && !excludedSourceFile.test(filePath);
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
