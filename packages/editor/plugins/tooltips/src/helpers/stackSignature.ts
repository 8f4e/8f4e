import {
	ArgumentType,
	type CompiledStackAnalysisLine,
	type CompilerASTLine,
	resolveInstructionStackEffect,
} from '@8f4e/language-spec';
import type { SourceInstruction } from './sourceLine';

interface StackSignatureLabels {
	inputs: readonly string[];
	outputs: readonly string[];
}

interface StackSignature {
	instruction: string;
	stackEffect: StackSignatureLabels;
}

interface ResolvedStackSignature extends StackSignature {
	kind: 'instruction' | 'call';
}

interface StackSignatureOptions {
	sourceInstruction: SourceInstruction | undefined;
	parsedLine?: CompilerASTLine;
	stackAnalysisLine?: CompiledStackAnalysisLine;
}

/** Resolves compiler metadata or source arguments before any signature formatting. */
export function resolveStackSignature({
	sourceInstruction,
	parsedLine,
	stackAnalysisLine,
}: StackSignatureOptions): ResolvedStackSignature | undefined {
	if (!sourceInstruction?.spec.stack) return undefined;
	const { instruction, arguments: args, spec } = sourceInstruction;

	if (
		instruction === 'call' &&
		args[0] &&
		stackAnalysisLine?.instruction === 'call' &&
		stackAnalysisLine.resolvedCall
	) {
		const { parameters, returns } = stackAnalysisLine.resolvedCall.signature;
		return {
			kind: 'call',
			instruction: `call ${args[0]}`,
			stackEffect: {
				inputs: parameters.map(parameter => `${parameter.name}: ${parameter.type}`),
				outputs: returns,
			},
		};
	}

	const signatureLine =
		parsedLine?.instruction === instruction
			? parsedLine
			: {
					arguments:
						instruction === 'storeBytes'
							? [{ type: ArgumentType.LITERAL, value: Number.parseInt(args[0] ?? '', 10), isInteger: true }]
							: args,
				};
	return {
		kind: 'instruction',
		instruction,
		stackEffect: resolveInstructionStackEffect(spec, signatureLine) ?? sourceInstruction.spec.stack,
	};
}

/**
 * Formats a resolved stack effect as a human-readable instruction signature.
 * The tooltip uses the Forth-style `( inputs -- outputs )` convention from the
 * instruction documentation.
 */
export function formatStackSignature({ instruction, stackEffect }: StackSignature): string {
	return `${instruction} (${stackEffect.inputs.join(' ')} -- ${stackEffect.outputs.join(' ')})`;
}

/** Wraps between complete stack labels, keeping named parameter/type pairs together. */
export function formatStackSignatureLines({
	signature: { instruction, stackEffect },
	maxLength,
}: {
	signature: StackSignature;
	maxLength: number;
}): string[] {
	const inputs = stackEffect.inputs.length
		? stackEffect.inputs.map((input, index) => (index === 0 ? `(${input}` : input))
		: ['('];
	const outputs = stackEffect.outputs.length
		? stackEffect.outputs.map((output, index) => (index === stackEffect.outputs.length - 1 ? `${output})` : output))
		: [')'];
	const parts = [instruction, ...inputs, '--', ...outputs];
	const lines: string[] = [];
	let line = '';
	for (const part of parts) {
		if (line && line.length + 1 + part.length > maxLength) {
			lines.push(line);
			line = part;
		} else {
			line = line ? `${line} ${part}` : part;
		}
	}
	lines.push(line);
	return lines;
}
