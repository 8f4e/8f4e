import type {
	CodegenPushLine,
	CompilationContext,
	CompilerASTLine,
	MapEndLine,
	ResolvedPushShapeLine,
	SemanticAssertEqualLine,
	SemanticCallLine,
} from '@8f4e/language-spec';
import { getInstructionSpec } from '@8f4e/language-spec';
import { analyzeAssertEqual } from './assertEqual';
import { analyzeCall } from './call';
import { analyzeExitIfTrue } from './controlFlow';
import { analyzeFunctionEnd } from './functionEnd';
import { analyzeLocalSet } from './localSet';
import { analyzeMapEnd } from './mapEnd';
import { analyzeClampAddress, analyzeLoadFloat } from './memory';
import { analyzeAbs } from './numeric/abs';
import { analyzeAdd } from './numeric/add';
import { analyzeAnd } from './numeric/and';
import { analyzeDiv } from './numeric/div';
import { analyzeMul } from './numeric/mul';
import { analyzeOr } from './numeric/or';
import { analyzeRemainder } from './numeric/remainder';
import { analyzeShiftLeft } from './numeric/shiftLeft';
import { analyzeShiftRight } from './numeric/shiftRight';
import { analyzeShiftRightUnsigned } from './numeric/shiftRightUnsigned';
import { analyzeSub } from './numeric/sub';
import { analyzeXor } from './numeric/xor';
import { analyzePush } from './push';
import { analyzePushShape } from './pushShape';
import { analyzeFromSpec } from './spec';
import type { InstructionAnalysisResult } from './types';

/**
 * Dispatches a compiler AST line to the instruction-specific or spec-derived stack analyzer.
 *
 * @param line - AST line being processed.
 * @param context - Compilation context used by the operation.
 * @returns The stack-analysis result for the instruction.
 */
export function analyzeByInstruction(line: CompilerASTLine, context: CompilationContext): InstructionAnalysisResult {
	switch (line.instruction) {
		case 'assertEqual':
			return analyzeAssertEqual(line as SemanticAssertEqualLine, context);
		case 'push': {
			return {
				consumed: [],
				produced: analyzePush(line as CodegenPushLine, context),
			};
		}
		case 'pushShape': {
			return {
				consumed: [],
				produced: analyzePushShape(line as ResolvedPushShapeLine, context),
			};
		}
		case 'add':
			return analyzeAdd(line, context);
		case 'sub':
			return analyzeSub(line, context);
		case 'mul':
			return analyzeMul(line, context);
		case 'div':
			return analyzeDiv(line, context);
		case 'and':
			return analyzeAnd(line, context);
		case 'shiftLeft':
			return analyzeShiftLeft(line, context);
		case 'shiftRight':
			return analyzeShiftRight(line, context);
		case 'shiftRightUnsigned':
			return analyzeShiftRightUnsigned(line, context);
		case 'or':
			return analyzeOr(line, context);
		case 'xor':
			return analyzeXor(line, context);
		case 'remainder':
			return analyzeRemainder(line, context);
		case 'abs':
			return analyzeAbs(line, context);
		case 'clampAddress':
		case 'clampModuleAddress':
		case 'clampGlobalAddress':
			return analyzeClampAddress(line, context);
		case 'loadFloat':
			return analyzeLoadFloat(context);
		case 'localSet':
			return analyzeLocalSet(line, context);
		case 'exitIfTrue':
			return analyzeExitIfTrue(line, context);
		case 'functionEnd':
			return { consumed: analyzeFunctionEnd(line, context), produced: [] };
		case 'call':
			return analyzeCall(line as SemanticCallLine, context);
		case 'mapEnd':
			return analyzeMapEnd(line as MapEndLine, context);
		default:
			return analyzeFromSpec(line, context, getInstructionSpec(line.instruction)) ?? { consumed: [], produced: [] };
	}
}
