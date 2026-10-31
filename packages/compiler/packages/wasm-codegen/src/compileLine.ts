import type {
	CodegenContext,
	CodegenPushLine,
	ExecutableInstructionLine,
	InstructionCompiler,
	StackAnalysisLineFacts,
} from '@8f4e/language-spec';
import type { Instruction } from './instructionCompilers';
import instructions from './instructionCompilers';
import push from './instructionCompilers/push';

/**
 * Emits bytecode for one instruction line using semantic-reference and stack-analysis facts.
 *
 * @param line - Resolved executable instruction.
 * @param stackFacts - Stack-analysis facts keyed to the same AST line.
 * @param context - Compilation context used by the operation.
 * @returns The computed result.
 */
export function compileCodegenLine(
	line: ExecutableInstructionLine,
	stackFacts: StackAnalysisLineFacts,
	context: CodegenContext
) {
	if ('inlineOperandPush' in line && line.inlineOperandPush) {
		push(line.inlineOperandPush as CodegenPushLine, context, stackFacts);
	}
	const instruction = line.instruction as Instruction;
	const compileInstruction = instructions[instruction] as InstructionCompiler;
	return compileInstruction(line, context, stackFacts);
}
