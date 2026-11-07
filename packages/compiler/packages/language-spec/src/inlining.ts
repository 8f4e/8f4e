import type { AssertionCodegenSites } from './assertions';
import type { CompilerDiagnosticContext } from './diagnostics';
import type { FunctionSignature } from './functionTypes';
import type { ExecutableInstructionLine, SourceLocalBinding, StackAnalysisLineFacts } from './semantic';

/** Size budgets for the opt-in, single-level function inliner. Counts are operations, not encoded bytes. */
export interface FunctionInliningOptions {
	/** Maximum callee body operations, excluding a final return. Default: 32. */
	maxCalleeOperations?: number;
	/** Maximum estimated caller operations including bindings, resets, and scope blocks. Default: 1,024. */
	maxCallerOperations?: number;
}

/** An unexpanded callee body. Binding identities and source facts remain scoped to this body. */
export interface InlineFunctionBody {
	id: string;
	signature: FunctionSignature;
	bindings: readonly SourceLocalBinding[];
	operations: readonly { line: ExecutableInstructionLine; facts: StackAnalysisLineFacts }[];
	diagnosticContext: CompilerDiagnosticContext;
	assertionCalls?: AssertionCodegenSites;
}

/** Selected expansions keyed by the caller's original executable operation index. */
export type FunctionInlineCalls = ReadonlyMap<number, InlineFunctionBody>;

/** Emission plan over the original analyzed program. Copied callee bodies contain ordinary calls only. */
export interface FunctionInliningPlan {
	functions: Readonly<Record<string, FunctionInlineCalls>>;
	modules: Readonly<Record<string, FunctionInlineCalls>>;
}
