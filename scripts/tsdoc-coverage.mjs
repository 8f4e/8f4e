#!/usr/bin/env node
/* global console, process */

import { execFileSync } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import ts from 'typescript';
import { getWorkspacePackageRoots, resolveWorkspaceSourceRoot } from './workspace-package-roots.mjs';

const workspaceRoot = process.cwd();
const outputDir = path.resolve(workspaceRoot, 'logs/tsdoc-coverage');
const suiteName = 'tsdoc-coverage';

const ignoredDirectories = new Set(['.tmp', 'dist', 'node_modules', '__snapshots__']);
const excludedFilePatterns = [/\.d\.ts$/, /\.test\.ts$/, /\.spec\.ts$/];

const declarationKinds = new Map([
	[ts.SyntaxKind.CallSignature, 'call-signature'],
	[ts.SyntaxKind.ClassDeclaration, 'class'],
	[ts.SyntaxKind.Constructor, 'constructor'],
	[ts.SyntaxKind.ConstructSignature, 'construct-signature'],
	[ts.SyntaxKind.EnumDeclaration, 'enum'],
	[ts.SyntaxKind.EnumMember, 'enum-member'],
	[ts.SyntaxKind.FunctionDeclaration, 'function'],
	[ts.SyntaxKind.GetAccessor, 'accessor'],
	[ts.SyntaxKind.IndexSignature, 'index-signature'],
	[ts.SyntaxKind.InterfaceDeclaration, 'interface'],
	[ts.SyntaxKind.MethodDeclaration, 'class-method'],
	[ts.SyntaxKind.MethodSignature, 'method-signature'],
	[ts.SyntaxKind.PropertyDeclaration, 'class-property'],
	[ts.SyntaxKind.PropertySignature, 'property-signature'],
	[ts.SyntaxKind.SetAccessor, 'accessor'],
	[ts.SyntaxKind.TypeAliasDeclaration, 'type'],
	[ts.SyntaxKind.VariableDeclaration, 'variable'],
]);

await main();

async function main() {
	const { roots, recursive } = await getPackageRoots();
	const packageEntries = (await Promise.all(roots.map(root => collectPackageEntries(root, recursive)))).flat();
	const commit = getGitCommit();
	const recordedAt = new Date().toISOString();
	const loggedEntries = [];
	const skippedEntries = [];

	for (const packageEntry of packageEntries) {
		const files = await collectMeasuredFiles(packageEntry.sourceRoot);
		const coverage = await measurePackageCoverage(files);
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

	printResults(loggedEntries, skippedEntries);
}

async function getPackageRoots() {
	const packageRootArgs = getArgValues('--package-root');

	if (packageRootArgs.length === 0) {
		return { roots: await getWorkspacePackageRoots(workspaceRoot), recursive: false };
	}

	return { roots: packageRootArgs.map(packageRoot => path.resolve(workspaceRoot, packageRoot)), recursive: true };
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

async function collectPackageEntries(root, recursive) {
	const packageJsonPaths = [];
	if (recursive) {
		await collectPackageJsonPaths(root, packageJsonPaths);
	} else {
		const packageJsonPath = path.join(root, 'package.json');
		if (await pathExists(packageJsonPath)) {
			packageJsonPaths.push(packageJsonPath);
		}
	}

	const packageEntries = [];

	for (const packageJsonPath of packageJsonPaths.sort()) {
		const packageRoot = path.dirname(packageJsonPath);
		const packageJson = await readJson(packageJsonPath);
		const packageName = packageJson.name;

		if (!packageName) {
			continue;
		}

		const sourceRoot = await resolveSourceRoot(packageRoot);

		if (!sourceRoot) {
			continue;
		}

		packageEntries.push({
			name: packageName,
			root: packageRoot,
			relativeRoot: toWorkspacePath(packageRoot),
			sourceRoot,
			relativeSourceRoot: toWorkspacePath(sourceRoot),
		});
	}

	return packageEntries;
}

async function collectPackageJsonPaths(dir, packageJsonPaths) {
	const entries = await fs.readdir(dir, { withFileTypes: true });

	for (const entry of entries) {
		const entryPath = path.join(dir, entry.name);

		if (entry.isDirectory()) {
			if (!ignoredDirectories.has(entry.name)) {
				await collectPackageJsonPaths(entryPath, packageJsonPaths);
			}

			continue;
		}

		if (entry.isFile() && entry.name === 'package.json') {
			packageJsonPaths.push(entryPath);
		}
	}
}

async function resolveSourceRoot(packageRoot) {
	const projectJsonPath = path.join(packageRoot, 'project.json');
	const projectJson = (await pathExists(projectJsonPath)) ? await readJson(projectJsonPath) : {};
	return resolveWorkspaceSourceRoot(workspaceRoot, packageRoot, projectJson.sourceRoot);
}

async function collectMeasuredFiles(root) {
	const files = [];
	await collectTypeScriptFiles(root, files);
	return files.sort();
}

async function collectTypeScriptFiles(dir, files) {
	const entries = await fs.readdir(dir, { withFileTypes: true });

	for (const entry of entries) {
		const entryPath = path.join(dir, entry.name);

		if (entry.isDirectory()) {
			if (!ignoredDirectories.has(entry.name)) {
				await collectTypeScriptFiles(entryPath, files);
			}

			continue;
		}

		if (entry.isFile() && shouldMeasureFile(entryPath)) {
			files.push(entryPath);
		}
	}
}

function shouldMeasureFile(filePath) {
	return filePath.endsWith('.ts') && !excludedFilePatterns.some(pattern => pattern.test(filePath));
}

async function measurePackageCoverage(files) {
	const summary = createCoverageSummary();

	for (const filePath of files) {
		const sourceText = await fs.readFile(filePath, 'utf8');
		const sourceFile = ts.createSourceFile(filePath, sourceText, ts.ScriptTarget.Latest, true);

		visitSourceFile(sourceFile, declaration => {
			const kind = declarationKinds.get(declaration.kind);

			if (!kind || !shouldCountDeclaration(declaration)) {
				return;
			}

			addCoverageEntry(summary, kind, hasTsdocComment(declaration));
		});
	}

	return toCoverageResult(summary);
}

function visitSourceFile(sourceFile, callback) {
	const visit = node => {
		callback(node);
		ts.forEachChild(node, visit);
	};

	visit(sourceFile);
}

function shouldCountDeclaration(declaration) {
	if (declaration.kind === ts.SyntaxKind.VariableDeclaration) {
		return isTopLevelVariableDeclaration(declaration);
	}

	return true;
}

function isTopLevelVariableDeclaration(declaration) {
	const declarationList = declaration.parent;
	const statement = declarationList?.parent;

	return ts.isVariableStatement(statement) && ts.isSourceFile(statement.parent);
}

function hasTsdocComment(declaration) {
	if (hasOwnTsdocComment(declaration)) {
		return true;
	}

	if (ts.isVariableDeclaration(declaration)) {
		const statement = declaration.parent?.parent;

		return Boolean(statement && hasOwnTsdocComment(statement));
	}

	return false;
}

function hasOwnTsdocComment(node) {
	return ts.getJSDocCommentsAndTags(node).some(comment => ts.isJSDoc(comment));
}

function createCoverageSummary() {
	return {
		documented: 0,
		total: 0,
		byKind: new Map(),
	};
}

function addCoverageEntry(summary, kind, documented) {
	summary.total += 1;

	if (documented) {
		summary.documented += 1;
	}

	const kindSummary = summary.byKind.get(kind) ?? {
		documented: 0,
		total: 0,
	};

	kindSummary.total += 1;

	if (documented) {
		kindSummary.documented += 1;
	}

	summary.byKind.set(kind, kindSummary);
}

function toCoverageResult(summary) {
	return {
		documented: summary.documented,
		total: summary.total,
		percentage: toPercentage(summary),
		byKind: Object.fromEntries(
			[...summary.byKind.entries()].map(([kind, kindSummary]) => [
				kind,
				{
					documented: kindSummary.documented,
					total: kindSummary.total,
					percentage: toPercentage(kindSummary),
				},
			])
		),
	};
}

function toPercentage(summary) {
	if (summary.total === 0) {
		return 100;
	}

	return Number(((summary.documented / summary.total) * 100).toFixed(1));
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
			documented: summary.documented + entry.coverage.documented,
			total: summary.total + entry.coverage.total,
		}),
		{ documented: 0, total: 0 }
	);

	console.log(
		[
			suiteName,
			`${loggedEntries.length} packages`,
			`${totals.documented}/${totals.total} documented`,
			`${toPercentage(totals)}%`,
			toWorkspacePath(outputDir),
		].join(' | ')
	);

	for (const entry of loggedEntries) {
		console.log(
			[
				entry.packageName,
				`${entry.coverage.documented}/${entry.coverage.total} documented`,
				`${entry.coverage.percentage}%`,
				toWorkspacePath(entry.outputPath),
			].join(' | ')
		);
	}

	for (const entry of skippedEntries) {
		console.log([entry.name, entry.reason, 'skipped'].join(' | '));
	}
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
