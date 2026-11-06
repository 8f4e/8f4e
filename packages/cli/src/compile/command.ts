import { parseProjectSource } from '@8f4e/compiler';
import { promises as fs } from 'fs';
import path from 'path';
import type { RuntimeMemoryInfo } from '../shared/types';
import { compileProject } from './compileProject';

interface CompileCommandArgs {
	inputPath?: string;
	wasmOutputPath?: string;
	memoryOutputPath?: string;
	disableSharedMemory: boolean;
}

function parseCompileArgs(args: string[]): CompileCommandArgs {
	let inputPath: string | undefined;
	let wasmOutputPath: string | undefined;
	let memoryOutputPath: string | undefined;
	let disableSharedMemory = false;

	for (let i = 0; i < args.length; i += 1) {
		const arg = args[i];
		if (arg === '--wasm-output' || arg === '--memory-output') {
			const value = args[i + 1];
			if (!value || value.startsWith('--')) {
				throw new Error(`Missing path for ${arg}`);
			}
			if (arg === '--wasm-output') {
				wasmOutputPath = value;
			} else {
				memoryOutputPath = value;
			}
			i += 1;
			continue;
		}
		if (arg === '--no-shared-memory') {
			disableSharedMemory = true;
			continue;
		}
		if (!inputPath && !arg.startsWith('-')) {
			inputPath = arg;
			continue;
		}
		throw new Error(`Unknown compile argument: ${arg}`);
	}

	return { inputPath, wasmOutputPath, memoryOutputPath, disableSharedMemory };
}

export function getCompileUsage(): string {
	return 'Usage: cli compile <input.8f4e> --wasm-output <output.wasm> [--memory-output <memory.json>] [--no-shared-memory]';
}

export async function runCompileCommand(args: string[]): Promise<void> {
	const { inputPath, wasmOutputPath, memoryOutputPath, disableSharedMemory } = parseCompileArgs(args);

	if (!inputPath) {
		throw new Error(getCompileUsage());
	}

	if (!wasmOutputPath) {
		throw new Error(getCompileUsage());
	}

	const resolvedInput = path.resolve(process.cwd(), inputPath);
	const resolvedWasmOutput = path.resolve(process.cwd(), wasmOutputPath);
	const resolvedMemoryOutput = memoryOutputPath ? path.resolve(process.cwd(), memoryOutputPath) : undefined;
	if (resolvedMemoryOutput === resolvedWasmOutput) {
		throw new Error('WASM and memory output paths must be different');
	}
	if (resolvedInput === resolvedWasmOutput || resolvedInput === resolvedMemoryOutput) {
		throw new Error('Output paths must not overwrite the input project');
	}

	if (path.extname(resolvedInput) !== '.8f4e') {
		throw new Error('Invalid input file: expected a .8f4e project file');
	}

	const inputRaw = await fs.readFile(resolvedInput, 'utf8');
	const project = parseProjectSource(inputRaw);

	const { compiledWasm, requiredMemoryBytes, memoryPlan } = await compileProject(project, {
		compilerOptions: { disableSharedMemory },
	});

	await fs.mkdir(path.dirname(resolvedWasmOutput), { recursive: true });
	await fs.writeFile(resolvedWasmOutput, Buffer.from(compiledWasm, 'base64'));
	if (resolvedMemoryOutput) {
		const memoryInfo: RuntimeMemoryInfo = { requiredMemoryBytes, memoryPlan };
		await fs.mkdir(path.dirname(resolvedMemoryOutput), { recursive: true });
		await fs.writeFile(resolvedMemoryOutput, JSON.stringify(memoryInfo, null, 2) + '\n');
	}
}
