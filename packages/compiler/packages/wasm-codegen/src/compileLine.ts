import type {
	AssertionCodegenCall,
	CodegenContext,
	ExecutableInstructionLine,
	InstructionCompiler,
	StackAnalysisLineFacts,
} from '@8f4e/language-spec';
import type { Instruction } from './instructionCompilers';
import instructions from './instructionCompilers';

/**
 * Emits bytecode for one instruction line using semantic-reference and stack-analysis facts.
 *
 * @param line - Resolved executable instruction.
 * @param stackFacts - Stack-analysis facts for the same executable operation.
 * @param context - Compilation context used by the operation.
 * @param assertionCall - Planned callback for this executable operation, when enabled.
 * @returns The computed result.
 */
export function compileCodegenLine(
	line: ExecutableInstructionLine,
	stackFacts: StackAnalysisLineFacts,
	context: CodegenContext,
	assertionCall?: AssertionCodegenCall
) {
	context.assertionCall = assertionCall;
	const instruction = line.instruction as Instruction;
	const compileInstruction = instructions[instruction] as InstructionCompiler;
	return compileInstruction(line, context, stackFacts);
}
