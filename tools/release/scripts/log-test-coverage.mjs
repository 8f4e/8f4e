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

const ignoredDirectories = new Set(['.tmp', 'coverage', 'dist', 'node_modules']);
const ignoredPackages = new Set(['glugglugglug']);
const excludedSourceFilePatterns = [/\.d\.ts$/, /\.test\.ts$/, /\.spec\.ts$/];
const coverageMetrics = ['statements', 'branches', 'functions', 'lines'];

await main();

async function main() {
	const projects = await getWorkspaceProjects(workspaceRoot, getOptionValues(args, '--package-root'));
	const packageEntries = projects.filter(project => !ignoredPackages.has(project.name));
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
