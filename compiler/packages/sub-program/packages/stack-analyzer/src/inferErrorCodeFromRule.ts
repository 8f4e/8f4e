import type { OperandRule } from '@8f4e/language-spec';
import { ErrorCode, type LineErrorCodeValue } from '@8f4e/language-spec';

/**
 * Maps an operand rule from the language spec to the semantic error emitted when it fails.
 *
 * @param rule - Operand rule from the language spec.
 * @returns The compiler error instance.
 */
export function inferErrorCodeFromRule(rule: OperandRule | OperandRule[]): LineErrorCodeValue {
	if (Array.isArray(rule)) {
		return ErrorCode.TYPE_MISMATCH;
	} else if (rule === 'int') {
		return ErrorCode.ONLY_INTEGERS;
	} else if (rule === 'float') {
		return ErrorCode.ONLY_FLOATS;
	} else if (rule === 'matching' || rule === 'sameType') {
		return ErrorCode.UNMATCHING_OPERANDS;
	}
	throw new Error(`Unexpected operand rule: ${rule}`);
}
