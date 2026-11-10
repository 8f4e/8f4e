import { parseProjectSource } from '@8f4e/compiler';
import { promises as fs } from 'fs';
import path from 'path';
import { compileProject } from '../compile/compileProject';
import { createRuntimeRunner } from '../run/runtimeRunner';

interface CaptureCommandArgs {
	inputPath?: string;
	bufferId?: string;
	cycles: number;
	repeat: number;
	sets: string[];
	setJsons: string[];
	loadFiles: string[];
	outPath?: string;
}

function parsePositiveInteger(raw: string, flag: string): number {
	const parsed = Number(raw);
	if (!Number.isInteger(parsed) || parsed <= 0) {
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

function parseCaptureArgs(args: string[]): CaptureCommandArgs {
	let inputPath: string | undefined;
	let bufferId: string | undefined;
	let cycles = 128;
	let repeat = 1;
	let outPath: string | undefined;
	const sets: string[] = [];
	const setJsons: string[] = [];
	const loadFiles: string[] = [];

	for (let i = 0; i < args.length; i += 1) {
		const arg = args[i];

		if (arg === '--buffer') {
			bufferId = args[i + 1];
			i += 1;
			continue;
		}
		if (arg === '--cycles') {
			cycles = parsePositiveInteger(args[i + 1] ?? '', '--cycles');
			i += 1;
			continue;
		}
		if (arg === '--repeat') {
			repeat = parsePositiveInteger(args[i + 1] ?? '', '--repeat');
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
		if (arg === '--out') {
			outPath = args[i + 1];
			i += 1;
			continue;
		}
		if (!inputPath && !arg.startsWith('-')) {
			inputPath = arg;
			continue;
		}

		throw new Error(`Unknown capture argument: ${arg}`);
	}

	return {
		inputPath,
		bufferId,
		cycles,
		repeat,
		sets,
		setJsons,
		loadFiles,
		outPath,
	};
}

export function getCaptureUsage(): string {
	return 'Usage: cli capture <input.8f4e> --buffer <id> [--cycles <n>] [--repeat <n>] [--set <id>=<value>]... [--set-json <id>=<json>]... [--load-file <id>=<path>]... --out <file.bin>';
}

export async function runCaptureCommand(args: string[]): Promise<void> {
	const parsed = parseCaptureArgs(args);

	if (!parsed.inputPath || !parsed.bufferId || !parsed.outPath) {
		throw new Error(getCaptureUsage());
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

	const chunks: Buffer[] = [];
	for (let i = 0; i < parsed.repeat; i += 1) {
		runner.runCycles(parsed.cycles);
		chunks.push(Buffer.from(runner.readBytes(parsed.bufferId)));
	}

	const resolvedOut = path.resolve(process.cwd(), parsed.outPath);
	await fs.mkdir(path.dirname(resolvedOut), { recursive: true });
	await fs.writeFile(resolvedOut, Buffer.concat(chunks));
}
