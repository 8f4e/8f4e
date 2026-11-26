import type { CompilationContext, CompilerASTLine } from '@8f4e/language-spec';
import { deriveKnownIntegerValue } from '../../utils/knownIntegerValue';
import { consume, produce } from '../stack';
import type { InstructionAnalysisResult } from '../types';
import { knownIntegerResult } from './shared';

/**
 * Analyzes `xor` stack effects and known integer propagation.
 *
 * @param _line - Unused source AST line kept for handler signature consistency.
 * @param context - Compilation context used by the operation.
 * @returns Stack-analysis result for the xor instruction.
 */
export function analyzeXor(_line: CompilerASTLine, context: CompilationContext): InstructionAnalysisResult {
	const consumed = consume(context, 2);
	const integerMetadata = deriveKnownIntegerValue(consumed[0], consumed[1], (value1, value2) => value1 ^ value2);
	const produced = [knownIntegerResult(integerMetadata.knownValue)];
	produce(context, produced);
	return { consumed, produced };
}
