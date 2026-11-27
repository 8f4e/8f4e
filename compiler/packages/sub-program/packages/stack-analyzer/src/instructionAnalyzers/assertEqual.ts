import type { CompilationContext, SemanticAssertEqualLine } from '@8f4e/language-spec';
import { peekStackOperands } from '../peekStackOperands';
import { validateOperandTypes } from '../validateOperandTypes';
import { analyzePush } from './push';
import { consume } from './stack';
import type { InstructionAnalysisResult } from './types';

/** Checks the inline expected value against the actual stack operand. */
export function analyzeAssertEqual(
	line: SemanticAssertEqualLine,
	context: CompilationContext
): InstructionAnalysisResult {
	analyzePush(line.expectedPush, context);
	validateOperandTypes(peekStackOperands(context.stack, 2), 'sameType', line, context);
	return { consumed: consume(context, 2), produced: [] };
}
