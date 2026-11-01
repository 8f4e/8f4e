import {
	ArgumentType,
	type CompiledStackAnalysisLine,
	getInstructionSpec,
	type InstructionSpec,
	memoryDeclarationInstructions,
} from '@8f4e/language-spec';

import { formatStackSignature, getInstructionStackSignature } from './stackSignature';
import { wrapTooltipText } from './text';

const memoryIdentifierRegExp = /^[a-z_]\w*$/i;
const memoryDeclarationInstructionSet = new Set<string>(memoryDeclarationInstructions);

/**
 * Returns the first non-whitespace token from a source line.
 */
export function getInstructionNameFromSourceLine(line: string): string | undefined {
	return line.trim().split(/\s+/)[0] || undefined;
}

/**
 * Resolves the compiler instruction spec for executable source lines.
 */
export function getInstructionSpecFromSourceLine(line: string): InstructionSpec | undefined {
	const instruction = getInstructionNameFromSourceLine(line);

	if (!instruction || instruction.startsWith(';')) {
		return undefined;
	}

	return getInstructionSpec(instruction);
}

/**
 * Extracts the declared memory identifier from a memory declaration line.
 */
export function getMemoryDeclarationIdFromSourceLine(line: string | undefined): string | undefined {
	const source = line?.split(';')[0].trim();

	if (!source) {
		return undefined;
	}

	const [instruction, id] = source.split(/\s+/);

	if (!memoryDeclarationInstructionSet.has(instruction) || !id || !memoryIdentifierRegExp.test(id)) {
		return undefined;
	}

	return id;
}

/**
 * Builds the synthetic line data needed by variadic stack signature formatters.
 */
function getStackSignatureLineFromSourceLine(line: string, instruction: string): unknown {
	const spec = getInstructionSpec(instruction);
	if (spec?.inlineOperand) {
		return { arguments: line.split(';')[0].trim().split(/\s+/).slice(1) };
	}
	if (instruction !== 'storeBytes') {
		return undefined;
	}

	const count = Number.parseInt(line.trim().split(/\s+/)[1] ?? '', 10);

	if (!Number.isFinite(count)) {
		return undefined;
	}

	return {
		lineNumber: 0,
		instruction: 'storeBytes',
		arguments: [{ type: ArgumentType.LITERAL, value: count, isInteger: true }],
	};
}

/**
 * Formats the stack signature for the instruction on a source line.
 */
export function getStackSignatureFromSourceLine(
	line: string,
	stackAnalysisLine?: CompiledStackAnalysisLine
): string | undefined {
	const instruction = getInstructionNameFromSourceLine(line);
	const spec = getInstructionSpecFromSourceLine(line);

	if (!instruction || !spec) {
		return undefined;
	}

	if (instruction === 'call' && stackAnalysisLine?.instruction === 'call' && stackAnalysisLine.resolvedCall) {
		const targetName = line.split(';')[0].trim().split(/\s+/)[1];
		if (targetName) {
			const { parameters, returns } = stackAnalysisLine.resolvedCall.signature;
			return formatStackSignature(`call ${targetName}`, {
				inputs: parameters.map(parameter => `${parameter.name}: ${parameter.type}`),
				outputs: returns,
			});
		}
	}

	return getInstructionStackSignature(instruction, getStackSignatureLineFromSourceLine(line, instruction));
}

/** Wraps concrete call signatures while preserving the existing instruction headers. */
export function getStackSignatureTooltipLines(
	line: string,
	maxLength: number,
	stackAnalysisLine?: CompiledStackAnalysisLine
): string[] {
	const signature = getStackSignatureFromSourceLine(line, stackAnalysisLine);
	if (!signature) return [];
	return stackAnalysisLine?.resolvedCall && getInstructionNameFromSourceLine(line) === 'call'
		? wrapTooltipText(signature, maxLength)
		: [signature];
}
