import type { CompilationContext, CompilerASTLine } from '@8f4e/language-spec';
import { ErrorCode, getError } from '@8f4e/language-spec';
import { deriveAddStackMetadata } from '../../utils/stackAddressMetadata';
import { consume, produce } from '../stack';
import type { InstructionAnalysisResult } from '../types';
import { numericResult } from './shared';

/**
 * Analyzes `add` stack effects and address metadata propagation.
 *
 * @param line - Source instruction used for diagnostics.
 * @param context - Compilation context used by the operation.
 * @returns Stack-analysis result for the add instruction.
 */
export function analyzeAdd(line: CompilerASTLine, context: CompilationContext): InstructionAnalysisResult {
	const consumed = consume(context, 2);
	if (consumed[0].kind === 'address' && consumed[1].kind === 'address') {
		throw getError(ErrorCode.INVALID_ADDRESS_ARITHMETIC, line, context);
	}
	const produced = [
		numericResult(consumed[0], consumed[1], {
			calculateKnownValue: (left, right) => left + right,
			deriveIntegerMetadata: deriveAddStackMetadata,
		}),
	];
	produce(context, produced);
	return { consumed, produced };
}
