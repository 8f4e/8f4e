import { getInstructionSpec, type ResolvedStackEffect, resolveInstructionStackEffect } from '@8f4e/language-spec';

/**
 * Formats a resolved stack effect as a human-readable instruction signature.
 * The tooltip uses the Forth-style `( inputs -- outputs )` convention from the
 * instruction documentation.
 */
export function formatStackSignature(instruction: string, stackEffect: ResolvedStackEffect): string {
	return `${instruction} (${stackEffect.inputs.join(' ')} -- ${stackEffect.outputs.join(' ')})`;
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
