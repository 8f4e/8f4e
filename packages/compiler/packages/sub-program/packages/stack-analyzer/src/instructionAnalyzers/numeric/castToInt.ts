import type { CompilationContext, CompilerASTLine } from '@8f4e/language-spec';
import { consume, produce } from '../stack';
import type { InstructionAnalysisResult } from '../types';
import { knownIntegerResult } from './shared';

/** Derives integer facts using WebAssembly's signed saturating float-to-i32 conversion. */
export function analyzeCastToInt(_line: CompilerASTLine, context: CompilationContext): InstructionAnalysisResult {
	const consumed = consume(context, 1);
	const value = consumed[0].knownValue;
	const knownValue =
		value === undefined
			? undefined
			: Number.isNaN(value)
				? 0
				: Math.max(-2147483648, Math.min(2147483647, Math.trunc(value)));
	// A nonzero float alone proves nothing about its truncated integer value.
	const produced = [knownIntegerResult(knownValue)];
	produce(context, produced);
	return { consumed, produced };
}
