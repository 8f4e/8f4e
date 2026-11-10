import { parseProjectSource } from '@8f4e/compiler';
import { promises as fs } from 'fs';
import path from 'path';
import { compileProject } from '../compile/compileProject';
import { createRuntimeRunner } from './runtimeRunner';

interface RunCommandArgs {
	inputPath?: string;
	cycles: number;
	sets: string[];
	setJsons: string[];
	loadFiles: string[];
	dumps: string[];
	outPath?: string;
}

function parsePositiveInteger(raw: string, flag: string): number {
	const parsed = Number(raw);
	if (!Number.isInteger(parsed) || parsed < 0) {
		throw new Error(`Invalid ${flag} value: ${raw}`);
	}
	return parsed;
}

function parseAssignment(raw: string): { id: string; value: string } {
	const eqIndex = raw.indexOf('=');
	if (eqIndex <= 0 || eqIndex === raw.length - 1) {
		throw new Error(`Invalid assignment: ${raw}`);
	}

	return {
		id: raw.slice(0, eqIndex),
		value: raw.slice(eqIndex + 1),
	};
}

function parseRunArgs(args: string[]): RunCommandArgs {
	let inputPath: string | undefined;
	let cycles = 1;
	let outPath: string | undefined;
	const sets: string[] = [];
	const setJsons: string[] = [];
	const loadFiles: string[] = [];
	const dumps: string[] = [];

	for (let i = 0; i < args.length; i += 1) {
		const arg = args[i];

		if (arg === '--cycles') {
			cycles = parsePositiveInteger(args[i + 1] ?? '', '--cycles');
			i += 1;
			continue;
		}
		if (arg === '--set') {
			sets.push(args[i + 1] ?? '');
			i += 1;
			continue;
		}
		if (arg === '--set-json') {
			setJsons.push(args[i + 1] ?? '');
			i += 1;
			continue;
		}
		if (arg === '--load-file') {
			loadFiles.push(args[i + 1] ?? '');
			i += 1;
			continue;
		}
		if (arg === '--dump') {
			dumps.push(args[i + 1] ?? '');
			i += 1;
			continue;
		}
		if (arg === '--out') {
			outPath = args[i + 1];
			i += 1;
			continue;
		}
		if (!inputPath && !arg.startsWith('-')) {
			inputPath = arg;
			continue;
		}

		throw new Error(`Unknown run argument: ${arg}`);
	}

	return {
		inputPath,
		cycles,
		sets,
		setJsons,
		loadFiles,
		dumps,
		outPath,
	};
}

export function getRunUsage(): string {
	return 'Usage: cli run <input.8f4e> [--cycles <n>] [--set <id>=<value>]... [--set-json <id>=<json>]... [--load-file <id>=<path>]... [--dump <id>]... [--out <file.json>]';
}

export async function runRunCommand(args: string[]): Promise<void> {
	const parsed = parseRunArgs(args);

	if (!parsed.inputPath) {
		throw new Error(getRunUsage());
	}

	if (parsed.dumps.length === 0) {
		throw new Error('At least one --dump <id> is required');
	}

	const resolvedInput = path.resolve(process.cwd(), parsed.inputPath);
	if (path.extname(resolvedInput) !== '.8f4e') {
		throw new Error('Invalid input file: expected a .8f4e project file');
	}

	const inputRaw = await fs.readFile(resolvedInput, 'utf8');
	const project = parseProjectSource(inputRaw);

	const compileResult = await compileProject(project);

	const runner = await createRuntimeRunner({
		compiledWasmBase64: compileResult.compiledWasm,
		memoryPlan: compileResult.memoryPlan,
		requiredMemoryBytes: compileResult.requiredMemoryBytes,
	});

	runner.initialize();

	for (const raw of parsed.sets) {
		const { id, value } = parseAssignment(raw);
		const numericValue = Number(value);
		if (Number.isNaN(numericValue)) {
			throw new Error(`Invalid numeric value for --set ${id}: ${value}`);
		}
		runner.write(id, numericValue);
	}

	for (const raw of parsed.setJsons) {
		const { id, value } = parseAssignment(raw);
		const parsedValue = JSON.parse(value) as unknown;
		if (typeof parsedValue === 'number') {
			runner.write(id, parsedValue);
			continue;
		}
		if (Array.isArray(parsedValue) && parsedValue.every(item => typeof item === 'number')) {
			runner.write(id, parsedValue);
			continue;
		}
		throw new Error(`Invalid JSON value for --set-json ${id}: expected number or number[]`);
	}

	for (const raw of parsed.loadFiles) {
		const { id, value } = parseAssignment(raw);
		const resolvedFile = path.resolve(process.cwd(), value);
		const bytes = await fs.readFile(resolvedFile);
		runner.writeBytes(id, bytes);
	}

	runner.runCycles(parsed.cycles);

	const output: Record<string, number | number[]> = {};
	for (const id of parsed.dumps) {
		output[id] = runner.read(id);
	}

	const serialized = JSON.stringify(output, null, 2);

	if (parsed.outPath) {
		const resolvedOut = path.resolve(process.cwd(), parsed.outPath);
		await fs.mkdir(path.dirname(resolvedOut), { recursive: true });
		await fs.writeFile(resolvedOut, serialized + '\n');
		return;
	}

	process.stdout.write(serialized + '\n');
}
