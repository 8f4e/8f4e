import { isPointerSource, parseFiniteNumber } from '@8f4e/editor-state';
import { isMemoryDeclarationLine } from '@8f4e/language-spec';
import { parseLine } from '@8f4e/tokenizer';

export interface MeterDirectiveData {
	memoryId?: string;
	lineNumber: number;
	minValueOverride?: number;
	maxValueOverride?: number;
}

function isInlineDeclaration(sourceLine: string | undefined, lineNumber: number): boolean {
	if (sourceLine === undefined) return false;
	try {
		return isMemoryDeclarationLine(parseLine(sourceLine, lineNumber));
	} catch {
		return false;
	}
}

export function createMeterDirectiveData(
	args: string[],
	lineNumber: number,
	sourceLine?: string
): MeterDirectiveData | undefined {
	const [memoryId] = args;
	if (memoryId === undefined) return isInlineDeclaration(sourceLine, lineNumber) ? { lineNumber } : undefined;
	if (!isPointerSource(memoryId)) return;
	if (args.length === 1) return { memoryId, lineNumber };

	if (args.length !== 3) {
		return undefined;
	}

	const minValueOverride = parseFiniteNumber(args[1]);
	const maxValueOverride = parseFiniteNumber(args[2]);
	if (minValueOverride === undefined || maxValueOverride === undefined) {
		return undefined;
	}

	return {
		memoryId,
		lineNumber,
		minValueOverride,
		maxValueOverride,
	};
}
