import { compileProject, parseProjectSource } from '@8f4e/compiler';
import { formatTestFailures, hasTestEntry, runTests } from '@8f4e/test-runner';
import { promises as fs } from 'fs';
import path from 'path';
import { resolveStdlibInclude } from '../shared/stdlibResolver';

interface TestCommandArgs {
	inputSpecs: string[];
}

interface TestFileResult {
	assertions: number;
	skipped: boolean;
}

function parseTestArgs(args: string[]): TestCommandArgs {
	const inputSpecs: string[] = [];

	for (const arg of args) {
		if (!arg.startsWith('-')) {
			inputSpecs.push(arg);
			continue;
		}

		throw new Error(`Unknown test argument: ${arg}`);
	}

	return { inputSpecs };
}

function hasGlobSyntax(value: string): boolean {
	return /[*?]/.test(value);
}

function toPosixPath(value: string): string {
	return value.split(path.sep).join('/');
}

function escapeRegExp(value: string): string {
	return value.replace(/[|\\{}()[\]^$+?.]/g, '\\$&');
}

function globToRegExp(pattern: string): RegExp {
	let source = '^';

	for (let i = 0; i < pattern.length; i += 1) {
		const character = pattern[i];
		const nextCharacter = pattern[i + 1];
		const followingCharacter = pattern[i + 2];

		if (character === '*' && nextCharacter === '*' && followingCharacter === '/') {
			source += '(?:.*/)?';
			i += 2;
			continue;
		}
		if (character === '*' && nextCharacter === '*') {
			source += '.*';
			i += 1;
			continue;
		}
		if (character === '*') {
			source += '[^/]*';
			continue;
		}
		if (character === '?') {
			source += '[^/]';
			continue;
		}

		source += escapeRegExp(character);
	}

	source += '$';

	return new RegExp(source);
}

function getGlobSearchRoot(pattern: string): string {
	const normalizedPattern = toPosixPath(pattern);
	const parsed = path.parse(normalizedPattern);
	const root = toPosixPath(parsed.root);
	const relativePattern = normalizedPattern.slice(root.length);
	const segments = relativePattern.split('/');
	const firstGlobSegmentIndex = segments.findIndex(hasGlobSyntax);
	const rootSegments = firstGlobSegmentIndex === -1 ? segments.slice(0, -1) : segments.slice(0, firstGlobSegmentIndex);

	return rootSegments.length > 0 ? path.join(root, ...rootSegments) : parsed.root;
}

async function collectFiles(directory: string): Promise<string[]> {
	const entries = await fs.readdir(directory, { withFileTypes: true });
	const files = await Promise.all(
		entries.map(entry => {
			const entryPath = path.join(directory, entry.name);

			if (entry.isDirectory()) {
				return collectFiles(entryPath);
			}
			if (entry.isFile()) {
				return [entryPath];
			}

			return [];
		})
	);

	return files.flat();
}

async function expandInputSpec(inputSpec: string): Promise<string[]> {
	const resolvedInput = path.resolve(process.cwd(), inputSpec);

	if (!hasGlobSyntax(inputSpec)) {
		return [resolvedInput];
	}

	const searchRoot = getGlobSearchRoot(resolvedInput);
	const matcher = globToRegExp(toPosixPath(resolvedInput));
	const files = await collectFiles(searchRoot);

	return files.filter(file => matcher.test(toPosixPath(file)));
}

async function resolveInputPaths(inputSpecs: string[]): Promise<string[]> {
	const expandedPaths = (await Promise.all(inputSpecs.map(expandInputSpec))).flat();
	const uniquePaths = Array.from(new Set(expandedPaths)).sort();

	if (uniquePaths.length === 0) {
		throw new Error('No input files matched.');
	}

	for (const inputPath of uniquePaths) {
		const extension = path.extname(inputPath);
		if (extension !== '.8f4e' && extension !== '.8f4em') {
			throw new Error('Invalid input file: expected a .8f4e project file or .8f4em module file');
		}
	}

	return uniquePaths;
}

function getErrorMessage(error: unknown): string {
	if (error instanceof Error) {
		return error.message;
	}
	if (typeof error === 'object' && error !== null && 'message' in error && typeof error.message === 'string') {
		return error.message;
	}
	return String(error);
}

export function getTestUsage(): string {
	return 'Usage: cli test <input.8f4e|input.8f4em|glob>...';
}

async function runTestFile(inputPath: string): Promise<TestFileResult> {
	const inputRaw = await fs.readFile(inputPath, 'utf8');
	const project = parseProjectSource(inputRaw);
	if (!hasTestEntry(project)) {
		return { assertions: 0, skipped: true };
	}

	const compiled = await compileProject(project, {
		enableAssertions: true,
		resolveInclude: resolveStdlibInclude,
	});
	const result = await runTests(compiled);
	if (result.failures.length > 0) {
		throw new Error(formatTestFailures(result.failures));
	}

	return { assertions: result.assertions.length, skipped: false };
}

export async function runTestCommand(args: string[]): Promise<void> {
	const { inputSpecs } = parseTestArgs(args);

	if (inputSpecs.length === 0) {
		throw new Error(getTestUsage());
	}

	const inputPaths = await resolveInputPaths(inputSpecs);
	let executedFiles = 0;
	let assertionCount = 0;

	for (const inputPath of inputPaths) {
		try {
			const result = await runTestFile(inputPath);
			if (!result.skipped) {
				executedFiles += 1;
				assertionCount += result.assertions;
			}
		} catch (error) {
			const relativePath = path.relative(process.cwd(), inputPath);
			const message = getErrorMessage(error);
			throw new Error(`${relativePath}\n${message}`);
		}
	}

	if (executedFiles === 0) {
		process.stdout.write('No tests found.\n');
		return;
	}

	const assertionLabel = `assertion${assertionCount === 1 ? '' : 's'}`;
	if (inputPaths.length === 1) {
		process.stdout.write(`Ran ${assertionCount} ${assertionLabel}.\n`);
		return;
	}

	process.stdout.write(
		`Ran ${assertionCount} ${assertionLabel} in ${executedFiles} file${executedFiles === 1 ? '' : 's'}.\n`
	);
}
