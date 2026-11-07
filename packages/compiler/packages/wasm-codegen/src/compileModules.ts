import type {
	AssertionCodegenSites,
	CompiledModule,
	CompileOptions,
	ComposedAST,
	ComposedModuleAST,
	FunctionInliningPlan,
	FunctionTypeRegistry,
	WasmFunctionLayout,
} from '@8f4e/language-spec';
import type { ModuleSemanticReferences } from '@8f4e/semantic-reference-resolver';
import type { StackAnalysisSubProgramReport } from '@8f4e/stack-analyzer';
import { compileModule } from './compileModule';

/**
 * Compiles resolved module bodies using a shared function type registry.
 *
 * @param modules - Resolved modules in execution order.
 * @param options - Compiler options for this compilation pass.
 * @param functionLayout - Final function indices shared with binary emission.
 * @param typeRegistry - Function type registry used for WASM block signatures.
 * @param stackReport - Sub-program stack-analysis report.
 * @returns The compiled module artifact.
 */
export function compileModules(
	modules: readonly ModuleSemanticReferences<ComposedModuleAST>[],
	options: CompileOptions,
	stackReport: StackAnalysisSubProgramReport,
	functionLayout: WasmFunctionLayout,
	typeRegistry?: FunctionTypeRegistry,
	assertionCalls?: ReadonlyMap<ComposedAST, AssertionCodegenSites>,
	inliningPlan?: FunctionInliningPlan
): CompiledModule[] {
	return modules.map((resolved, index) =>
		compileModule(
			resolved,
			index,
			functionLayout,
			stackReport.modules[resolved.ast.id],
			options,
			typeRegistry,
			assertionCalls?.get(resolved.ast),
			inliningPlan?.modules[resolved.ast.id]
		)
	);
}
