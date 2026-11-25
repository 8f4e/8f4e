import { promises as fs } from 'fs';
import path from 'path';
import { format8f4e } from './format8f4e';

interface FormatCommandArgs {
	inputPath?: string;
	commentWidth: number;
	outPath?: string;
	write: boolean;
}

function parsePositiveInteger(raw: string, flag: string): number {
	const parsed = Number(raw);
	if (!Number.isInteger(parsed) || parsed <= 0) {
		throw new Error(`Invalid ${flag} value: ${raw}`);
	}
	return parsed;
}

function parseFormatArgs(args: string[]): FormatCommandArgs {
	let inputPath: string | undefined;
	let outPath: string | undefined;
	let commentWidth = 32;
	let write = false;

	for (let i = 0; i < args.length; i += 1) {
		const arg = args[i];

		if (arg === '--comment-width') {
			commentWidth = parsePositiveInteger(args[i + 1] ?? '', '--comment-width');
			i += 1;
			continue;
		}
		if (arg === '--out') {
			outPath = args[i + 1];
			i += 1;
			continue;
		}
		if (arg === '--write') {
			write = true;
			continue;
		}
		if (!inputPath && !arg.startsWith('-')) {
			inputPath = arg;
			continue;
		}

		throw new Error(`Unknown format argument: ${arg}`);
	}

	return {
		inputPath,
		commentWidth,
		outPath,
		write,
	};
}

export function getFormatUsage(): string {
	return 'Usage: cli format <input.8f4e|input.8f4em> [--comment-width <n>] [--out <file>] [--write]';
}

export async function runFormatCommand(args: string[]): Promise<void> {
	const parsed = parseFormatArgs(args);

	if (!parsed.inputPath) {
		throw new Error(getFormatUsage());
	}

	if (parsed.outPath && parsed.write) {
		throw new Error('Use either --out <file> or --write, not both.');
	}

	const resolvedInput = path.resolve(process.cwd(), parsed.inputPath);
	const ext = path.extname(resolvedInput);
	if (ext !== '.8f4e' && ext !== '.8f4em') {
		throw new Error('Invalid input file: expected a .8f4e project file or .8f4em module file');
	}

	const inputRaw = await fs.readFile(resolvedInput, 'utf8');
	const formatted = format8f4e(inputRaw, { commentWidth: parsed.commentWidth });

	if (parsed.write) {
		await fs.writeFile(resolvedInput, formatted);
		return;
	}

	if (parsed.outPath) {
		const resolvedOut = path.resolve(process.cwd(), parsed.outPath);
		await fs.mkdir(path.dirname(resolvedOut), { recursive: true });
		await fs.writeFile(resolvedOut, formatted);
		return;
	}

	process.stdout.write(formatted);
}
