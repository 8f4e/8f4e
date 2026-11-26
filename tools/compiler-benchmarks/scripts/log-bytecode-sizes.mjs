#!/usr/bin/env node

import { execFile, execFileSync } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

const workspaceRoot = process.cwd();
const benchmarkDir = fileURLToPath(new URL('../cases/', import.meta.url));
const outputDir = path.resolve(workspaceRoot, 'logs/bytecode-size');
const cliPath = fileURLToPath(import.meta.resolve('@8f4e/cli/cli'));
const suiteName = 'bytecode-size';

async function main() {
	const benchmarkCases = await collectBenchmarkCases(benchmarkDir);
	const gitMetadata = getGitMetadata();
	const packageJson = await readJson(new URL(import.meta.resolve('@8f4e/compiler/package.json')));

	if (benchmarkCases.length === 0) {
		console.error(`No bytecode-size benchmark cases matched in ${path.relative(workspaceRoot, benchmarkDir)}`);
		process.exit(1);
	}

	const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), '8f4e-bytecode-size-'));
	try {
		const loggedCases = [];
		const skippedCases = [];

		for (const benchmarkCase of benchmarkCases) {
			const wasmPath = path.join(tempRoot, `${benchmarkCase.slug}.wasm`);
			await execFileAsync(process.execPath, [cliPath, 'compile', benchmarkCase.filePath, '--wasm-output', wasmPath], {
				cwd: workspaceRoot,
				maxBuffer: 1024 * 1024 * 20,
			});

			const emittedBytes = (await fs.stat(wasmPath)).size;
			const outputPath = getCaseLogPath(outputDir, benchmarkCase);
			const version = packageJson.version ?? null;

			if (await hasLoggedBenchmarkVersion(outputPath, version)) {
				skippedCases.push({
					sourcePath: benchmarkCase.path,
					version,
					outputPath,
				});
				continue;
			}

			const entry = {
				commit: gitMetadata.commit,
				version,
				benchmark: benchmarkCase.relativePath,
				emittedBytes,
			};

			await appendLogEntry(outputPath, entry);
			loggedCases.push({
				...entry,
				sourcePath: benchmarkCase.path,
				outputPath,
			});
		}

		if (loggedCases.length === 0) {
			console.log(
				`No bytecode-size benchmark results were logged because compiler version ${packageJson.version ?? 'unknown'} already has entries.`
			);
			return;
		}

		const totals = sumCases(loggedCases);

		console.log(
			[
				suiteName,
				`${totals.emittedBytes} emitted bytes`,
				`${totals.cases} cases`,
				path.relative(workspaceRoot, outputDir),
			].join(' | ')
		);

		for (const benchmarkCase of loggedCases) {
			console.log(
				[
					benchmarkCase.sourcePath,
					`${benchmarkCase.emittedBytes} emitted bytes`,
					path.relative(workspaceRoot, benchmarkCase.outputPath),
				].join(' | ')
			);
		}

		for (const benchmarkCase of skippedCases) {
			console.log(
				[
					benchmarkCase.sourcePath,
					`compiler version ${benchmarkCase.version ?? 'unknown'} already logged`,
					path.relative(workspaceRoot, benchmarkCase.outputPath),
					'skipped',
				].join(' | ')
			);
		}
	} finally {
		await fs.rm(tempRoot, { recursive: true, force: true });
	}
}

async function collectBenchmarkCases(root) {
	const files = [];
	await collectFiles(root, root, files);

	return files
		.map(({ filePath, relativePath }) => ({
			filePath,
			path: path.relative(workspaceRoot, filePath).split(path.sep).join('/'),
			relativePath,
			slug: relativePath.replace(/\.8f4e$/, '').replace(/[^a-zA-Z0-9_-]+/g, '-'),
			logPath: relativePath.replace(/\.8f4e$/, '.json'),
		}))
		.sort((left, right) => left.relativePath.localeCompare(right.relativePath));
}

async function collectFiles(root, dir, files) {
	const entries = await fs.readdir(dir, { withFileTypes: true });

	for (const entry of entries) {
		const entryPath = path.join(dir, entry.name);

		if (entry.isDirectory()) {
			await collectFiles(root, entryPath, files);
			continue;
		}

		if (!entry.isFile() || !entry.name.endsWith('.8f4e')) {
			continue;
		}

		files.push({
			filePath: entryPath,
			relativePath: path.relative(root, entryPath).split(path.sep).join('/'),
		});
	}
}

function sum(items, key) {
	return items.reduce((total, item) => total + item[key], 0);
}

function sumCases(cases) {
	return {
		cases: cases.length,
		emittedBytes: sum(cases, 'emittedBytes'),
	};
}

function getCaseLogPath(outputDir, benchmarkCase) {
	return path.join(outputDir, benchmarkCase.logPath);
}

async function hasLoggedBenchmarkVersion(filePath, version) {
	if (!(await pathExists(filePath))) {
		return false;
	}

	const existingEntries = await readJson(filePath);

	if (!Array.isArray(existingEntries)) {
		throw new Error(`${path.relative(workspaceRoot, filePath)} must contain a JSON array`);
	}

	return existingEntries.some(entry => entry?.version === version);
}

async function appendLogEntry(filePath, entry) {
	await fs.mkdir(path.dirname(filePath), { recursive: true });

	const existingEntries = (await pathExists(filePath)) ? await readJson(filePath) : [];

	if (!Array.isArray(existingEntries)) {
		throw new Error(`${path.relative(workspaceRoot, filePath)} must contain a JSON array`);
	}

	existingEntries.push(entry);
	await fs.writeFile(filePath, `${JSON.stringify(existingEntries, null, '\t')}\n`);
}

function getGitMetadata() {
	return {
		commit: runGit(['rev-parse', 'HEAD']),
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

await main();
