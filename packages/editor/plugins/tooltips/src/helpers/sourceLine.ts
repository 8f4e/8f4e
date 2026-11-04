import {
	getInstructionSpec,
	type InstructionSpec,
	isReferenceSlotInstruction,
	memoryDeclarationInstructions,
} from '@8f4e/language-spec';

const memoryIdentifierRegExp = /^[a-z_]\w*$/i;
const memoryDeclarationInstructionSet = new Set<string>(memoryDeclarationInstructions);

export interface SourceInstruction {
	instruction: string;
	arguments: string[];
	spec: InstructionSpec;
}

function getSourceLineTokens(line: string | undefined): string[] {
	const source = line?.split(';')[0].trim();
	return source ? source.split(/\s+/) : [];
}

/**
 * Returns the first non-whitespace token from a source line.
 */
export function getInstructionNameFromSourceLine(line: string): string | undefined {
	return getSourceLineTokens(line)[0];
}

/**
 * Extracts a recognized instruction and its source arguments with one spec lookup.
 */
export function getSourceInstruction(line: string): SourceInstruction | undefined {
	const [instruction, ...args] = getSourceLineTokens(line);
	const spec = instruction ? getInstructionSpec(instruction) : undefined;
	return spec ? { instruction, arguments: args, spec } : undefined;
}

/**
 * Extracts the declared memory identifier from a memory declaration line.
 */
export function getMemoryDeclarationIdFromSourceLine(line: string | undefined): string | undefined {
	const [instruction, id] = getSourceLineTokens(line);

	if (!memoryDeclarationInstructionSet.has(instruction) || !id || !memoryIdentifierRegExp.test(id)) {
		return undefined;
	}

	return id;
}

/** Extracts the identifier of a fixed reference declaration. */
export function getReferenceDeclarationIdFromSourceLine(line: string | undefined): string | undefined {
	const [instruction, id] = getSourceLineTokens(line);
	return instruction && isReferenceSlotInstruction(instruction) && id && memoryIdentifierRegExp.test(id)
		? id
		: undefined;
}
