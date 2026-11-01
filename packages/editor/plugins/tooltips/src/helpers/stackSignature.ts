import { getInstructionSpec, resolveInstructionStackEffect } from '@8f4e/language-spec';

interface StackSignatureLabels {
	inputs: readonly string[];
	outputs: readonly string[];
}

/**
 * Formats a resolved stack effect as a human-readable instruction signature.
 * The tooltip uses the Forth-style `( inputs -- outputs )` convention from the
 * instruction documentation.
 */
export function formatStackSignature(instruction: string, stackEffect: StackSignatureLabels): string {
	return `${instruction} (${stackEffect.inputs.join(' ')} -- ${stackEffect.outputs.join(' ')})`;
}

/** Wraps between complete stack labels, keeping named parameter/type pairs together. */
export function formatStackSignatureLines(
	instruction: string,
	stackEffect: StackSignatureLabels,
	maxLength: number
): string[] {
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

/**
 * Returns the formatted stack signature for an instruction when stack metadata exists.
 * If a source line is supplied, dynamic stack effects are resolved against that
 * line; otherwise the static signature from the instruction spec is used.
 */
export function getInstructionStackSignature(instruction: string, line?: unknown): string | undefined {
	const spec = getInstructionSpec(instruction);

	if (!spec?.stack) {
		return undefined;
	}

	return formatStackSignature(
		instruction,
		line ? (resolveInstructionStackEffect(spec, line) ?? spec.stack) : spec.stack
	);
}
