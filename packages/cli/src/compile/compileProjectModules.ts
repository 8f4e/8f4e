import { compileProject } from '@8f4e/compiler';
import type {
	CompiledFunctionLookup,
	CompiledModuleLookup,
	CompileOptions,
	MemoryDefaults,
	MemoryLayoutPlan,
	MemoryPointerMetadataMap,
	ProjectIncludeResolver,
	ProjectMemoryExposuresByGroupPath,
	ProjectObjectModel,
} from '@8f4e/language-spec';
import { resolveStdlibInclude } from '../shared/stdlibResolver';

interface CompileProjectModulesOptions {
	compilerOptions: CompileOptions;
	resolveInclude?: ProjectIncludeResolver;
}

interface CompileProjectModulesResult {
	compiledModules: CompiledModuleLookup;
	compiledFunctions?: CompiledFunctionLookup;
	memoryPlan: MemoryLayoutPlan;
	memoryDefaultsByModuleId: Record<string, MemoryDefaults>;
	pointerMetadataByModuleId: Record<string, MemoryPointerMetadataMap>;
	projectMemoryExposuresByGroupPath: ProjectMemoryExposuresByGroupPath;
	compiledWasm: string;
	requiredMemoryBytes: number;
}

function hasCompilableProgramBlocks(project: ProjectObjectModel): boolean {
	return (
		project.execution.some(block => (block.type === 'group' ? hasCompilableProgramBlocks(block) : !block.disabled)) ||
		project.constants.some(block => !block.disabled)
	);
}

export default async function compileProjectModules(
	project: ProjectObjectModel,
	options: CompileProjectModulesOptions
): Promise<CompileProjectModulesResult> {
	if (!hasCompilableProgramBlocks(project)) {
		return {
			compiledModules: {},
			memoryPlan: { modules: {}, moduleList: [] },
			memoryDefaultsByModuleId: {},
			pointerMetadataByModuleId: {},
			projectMemoryExposuresByGroupPath: {},
			compiledWasm: '',
			requiredMemoryBytes: 0,
		};
	}

	const result = await compileProject(project, {
		...options.compilerOptions,
		resolveInclude: options.resolveInclude ?? resolveStdlibInclude,
	});

	return {
		compiledModules: result.compiledModules,
		compiledFunctions: result.compiledFunctions,
		memoryPlan: result.memoryPlan,
		memoryDefaultsByModuleId: result.memoryDefaultsByModuleId,
		pointerMetadataByModuleId: result.pointerMetadataByModuleId,
		projectMemoryExposuresByGroupPath: result.projectMemoryExposuresByGroupPath,
		compiledWasm: Buffer.from(result.codeBuffer).toString('base64'),
		requiredMemoryBytes: result.requiredMemoryBytes,
	};
}
