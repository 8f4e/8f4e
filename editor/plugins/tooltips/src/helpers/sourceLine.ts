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

/** The current source interpretation shared by documentation, live-value preparation, and compiler lookup. */
export interface SourceLineDescription {
	text: string | undefined;
	sourceInstruction: SourceInstruction | undefined;
	declaration: { kind: 'memory' | 'reference'; id: string } | undefined;
}

function getSourceLineTokens(line: string | undefined): string[] {
	const source = line?.split(';')[0].trim();
	return source ? source.split(/\s+/) : [];
}

/** Classifies current source text once, including incomplete edits that are absent from the accepted compiler AST. */
export function describeSourceLine(line: string | undefined): SourceLineDescription {
	const [instruction, ...args] = getSourceLineTokens(line);
	const spec = instruction ? getInstructionSpec(instruction) : undefined;
	const id = args[0];
	let declaration: SourceLineDescription['declaration'];
	if (instruction && id && memoryIdentifierRegExp.test(id)) {
		if (memoryDeclarationInstructionSet.has(instruction)) declaration = { kind: 'memory', id };
		else if (isReferenceSlotInstruction(instruction)) declaration = { kind: 'reference', id };
	}
	return {
		text: line,
		sourceInstruction: instruction && spec ? { instruction, arguments: args, spec } : undefined,
		declaration,
	};
}
