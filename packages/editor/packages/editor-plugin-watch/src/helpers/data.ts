import { ArgumentType, isMemoryDeclarationLine } from '@8f4e/language-spec';
import { parseLine } from '@8f4e/tokenizer';

export interface WatchDirectiveData {
	id: string;
	lineNumber: number;
}

function applyWatchTemplate(template: string, inferredId: string): string | undefined {
	let remaining = template;
	let formatPrefix = '';
	let leadingOperator = '';
	let trailingEndAddress = '';
	let indexSuffix = '';

	if (remaining.startsWith('0b') || remaining.startsWith('0x')) {
		formatPrefix = remaining.slice(0, 2);
		remaining = remaining.slice(2);
	}

	if (remaining.startsWith('&') || remaining.startsWith('*')) {
		leadingOperator = remaining[0];
		remaining = remaining.slice(1);
	}

	if (remaining.endsWith('&')) {
		trailingEndAddress = '&';
		remaining = remaining.slice(0, -1);
	}

	const indexMatch = remaining.match(/\[\d+\]$/);
	if (indexMatch) {
		indexSuffix = indexMatch[0];
		remaining = remaining.slice(0, -indexSuffix.length);
	}

	if (remaining.length > 0) {
		return undefined;
	}

	return formatPrefix + leadingOperator + inferredId + trailingEndAddress + indexSuffix;
}

function inferWatchIdFromSourceLine(sourceLine: string, lineNumber: number): string | undefined {
	try {
		const parsedLine = parseLine(sourceLine, lineNumber);
		const [firstArg] = parsedLine.arguments;

		if (!isMemoryDeclarationLine(parsedLine)) {
			return undefined;
		}

		if (!firstArg) {
			return '__anonymous__' + lineNumber;
		}

		if (firstArg.type === ArgumentType.IDENTIFIER && firstArg.referenceKind === 'plain') {
			return firstArg.value;
		}

		if (firstArg.type === ArgumentType.LITERAL) {
			return '__anonymous__' + lineNumber;
		}

		if (
			firstArg.type === ArgumentType.IDENTIFIER &&
			firstArg.referenceKind === 'constant' &&
			parsedLine.arguments.length > 1
		) {
			return '__anonymous__' + lineNumber;
		}

		return undefined;
	} catch {
		return undefined;
	}
}

export function createWatchDirectiveData(
	args: string[],
	lineNumber: number,
	sourceLine?: string
): WatchDirectiveData | undefined {
	const inferredId = sourceLine ? inferWatchIdFromSourceLine(sourceLine, lineNumber) : undefined;
	const id = !args[0] ? inferredId : inferredId ? (applyWatchTemplate(args[0], inferredId) ?? args[0]) : args[0];
	if (!id) {
		return undefined;
	}

	return {
		id,
		lineNumber,
	};
}
