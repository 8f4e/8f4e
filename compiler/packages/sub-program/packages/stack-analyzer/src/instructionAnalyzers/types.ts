import type {
	CompilationContext,
	CompilerASTLine,
	Stack,
	StackAnalysisClampFact,
	StackAnalysisMapFact,
	StackAnalysisNumericValueKind,
} from '@8f4e/language-spec';

/** Stack delta produced by analyzing one compiler instruction. */
export type InstructionAnalysisResult = {
	consumed: Stack;
	produced: Stack;
	dropped?: Stack;
	targetFunctionId?: string;
	numericOperandKind?: StackAnalysisNumericValueKind;
	map?: StackAnalysisMapFact;
	clamp?: StackAnalysisClampFact;
};

/** Function shape shared by stack analyzers that handle specific compiler instructions. */
export type InstructionAnalyzer<TLine extends CompilerASTLine = CompilerASTLine> = (
	line: TLine,
	context: CompilationContext
) => InstructionAnalysisResult;
