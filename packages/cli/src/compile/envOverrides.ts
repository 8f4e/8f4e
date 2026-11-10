import type { ProjectObjectModel } from '@8f4e/language-spec';
import {
	foldArgumentContinuationLines,
	isComment,
	isInstructionLikeLine,
	parseInstructionTokens,
	parseNumericLiteralToken,
} from '@8f4e/tokenizer';

/** Rewrites existing literal declarations in the parsed project's root env blocks. */
export function applyEnvOverrides(project: ProjectObjectModel, overrides: ReadonlyMap<string, number>): void {
	const remaining = new Set(overrides.keys());
	for (const { code, disabled } of project.constants) {
		if (disabled) continue;
		const lines = foldArgumentContinuationLines(code);
		const header = lines[0];
		if (!header || parseInstructionTokens(header.line, header.lineNumber)[1] !== 'env') continue;

		for (const [index, { line, lineNumber }] of lines.entries()) {
			const [instruction, name, sourceValue, extra] = parseInstructionTokens(line, lineNumber);
			const value = overrides.get(name);
			if (instruction !== 'const' || value === undefined) continue;

			const original = sourceValue && parseNumericLiteralToken(sourceValue);
			if (!original || extra !== undefined) {
				throw new Error(`Root env constant ${name} must be defined with a numeric literal to override it`);
			}
			if (original.isInteger && !Number.isSafeInteger(value)) {
				throw new Error(`Override for env:${name} must be a safe integer`);
			}
			const float = Object.is(value, -0) ? '-0.0' : value.toExponential();
			const replacement = original.isInteger ? String(value) : `${float}${original.isFloat64 ? 'f64' : ''}`;

			// The final token may be on a physical continuation line.
			const nextLineNumber = lines[index + 1]?.lineNumber ?? code.length;
			let valueLine = nextLineNumber - 1;
			while (isComment(code[valueLine]) || !isInstructionLikeLine(code[valueLine])) {
				valueLine--;
			}
			code[valueLine] = code[valueLine].replace(/[^\s;]+(?=\s*(?:;|$))/, replacement);
			remaining.delete(name);
		}
	}
	if (remaining.size > 0) {
		throw new Error(`Unknown root env constant: ${[...remaining].join(', ')}`);
	}
}
