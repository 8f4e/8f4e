import type { CompileOptions, ProjectObjectModel } from '@8f4e/language-spec';
import type { CompileProjectOptions, CompileProjectResult } from '../shared/types';
import compileProjectModules from './compileProjectModules';

export async function compileProject(
	project: ProjectObjectModel,
	options: CompileProjectOptions = {}
): Promise<CompileProjectResult> {
	const includeModules = options.includeModules ?? true;
	const includeWasm = options.includeWasm ?? true;

	const compilerOptions: CompileOptions = {
		startingMemoryAllocationUnitAddress: options.compilerOptions?.startingMemoryAllocationUnitAddress ?? 0,
		disableSharedMemory: options.compilerOptions?.disableSharedMemory,
	};

	const moduleResult = await compileProjectModules(project, {
		compilerOptions,
		resolveInclude: options.resolveInclude,
	});

	const outputProject: Record<string, unknown> = { ...project };
	if (includeModules) {
		outputProject.compiledModules = moduleResult.compiledModules;
		outputProject.memoryPlan = moduleResult.memoryPlan;
		outputProject.memoryDefaultsByModuleId = moduleResult.memoryDefaultsByModuleId;
		outputProject.pointerMetadataByModuleId = moduleResult.pointerMetadataByModuleId;
		outputProject.projectMemoryExposuresByGroupPath = moduleResult.projectMemoryExposuresByGroupPath;
	}
	if (includeWasm) {
		outputProject.compiledWasm = moduleResult.compiledWasm;
	}

	return {
		outputProject,
		compilerOptions,
		compiledModules: moduleResult.compiledModules,
		memoryPlan: moduleResult.memoryPlan,
		memoryDefaultsByModuleId: moduleResult.memoryDefaultsByModuleId,
		pointerMetadataByModuleId: moduleResult.pointerMetadataByModuleId,
		projectMemoryExposuresByGroupPath: moduleResult.projectMemoryExposuresByGroupPath,
		compiledFunctions: moduleResult.compiledFunctions,
		compiledWasm: moduleResult.compiledWasm,
		requiredMemoryBytes: moduleResult.requiredMemoryBytes,
	};
}
