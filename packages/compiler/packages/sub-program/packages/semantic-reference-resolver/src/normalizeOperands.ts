import type { CompilerASTLine, PushArgument, PushLine } from '@8f4e/language-spec';
import { getInstructionSpec } from '@8f4e/language-spec';

function pushOperand(line: CompilerASTLine, argument: PushArgument): PushLine {
	return { lineNumber: line.lineNumber, instruction: 'push', arguments: [argument] };
}

/** Expands source operand shorthand once; each operation keeps the physical source line. */
export function normalizeOperands(line: CompilerASTLine): CompilerASTLine[] {
	if (line.instruction === 'call') {
		return [
			...line.arguments.slice(1).map(argument => pushOperand(line, argument)),
			{ ...line, arguments: [line.arguments[0]] },
		];
	}
	const spec = getInstructionSpec(line.instruction);
	if (spec && 'inlineOperand' in spec && spec.inlineOperand && line.arguments.length) {
		return [pushOperand(line, line.arguments[0] as PushArgument), { ...line, arguments: [] } as CompilerASTLine];
	}
	return [line];
}
