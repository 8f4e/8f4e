import type { State } from '@8f4e/editor-state-types';
import {
	createProjectModuleId,
	getProjectGroupPathFromModuleId,
	type PlannedMemoryDeclaration,
	type ProjectGroupPath,
	type ProjectModuleId,
	type ResolvedProjectMemoryExposure,
} from '@8f4e/language-spec';

/** The module or project scope in which a memory reference is evaluated. */
export type MemoryScope =
	| { kind: 'module'; moduleId: ProjectModuleId }
	| { kind: 'project'; groupPath: ProjectGroupPath };

export interface ResolvedMemoryTarget {
	publicModuleId: string;
	publicName: string;
	moduleId: string;
	memory: PlannedMemoryDeclaration;
	exposure?: ResolvedProjectMemoryExposure;
}

// Compilation replaces exposure arrays; weak keys release indexes from previous compilations and projects.
const exposureIndexes = new WeakMap<ResolvedProjectMemoryExposure[], Map<string, ResolvedProjectMemoryExposure>>();

/** Resolves a plain memory reference once for widgets, connectors, and environment bindings. */
export default function resolveMemoryTarget(
	state: Pick<State, 'compiler'>,
	scope: MemoryScope,
	reference: string | undefined
): ResolvedMemoryTarget | undefined {
	if (!reference) return;

	const namespaceId = scope.kind === 'module' ? scope.moduleId : scope.groupPath;
	const projectPath = scope.kind === 'module' ? getProjectGroupPathFromModuleId(scope.moduleId) : scope.groupPath;
	const separator = reference.indexOf(':');
	const publicName = separator === -1 ? reference : reference.slice(separator + 1);
	const referencedNamespace = separator === -1 ? undefined : reference.slice(0, separator);
	const publicModuleId =
		referencedNamespace === undefined
			? namespaceId
			: referencedNamespace.includes('/')
				? referencedNamespace
				: createProjectModuleId(projectPath, referencedNamespace);

	const memory =
		separator !== -1 || scope.kind === 'module'
			? state.compiler.result.memoryPlan.modules[publicModuleId]?.memory[publicName]
			: undefined;
	const directTarget = memory ? { publicModuleId, publicName, moduleId: publicModuleId, memory } : undefined;
	if (separator === -1 && scope.kind === 'module') return directTarget;

	const exposures = state.compiler.result.projectMemoryExposuresByGroupPath[publicModuleId];
	if (!exposures) return directTarget;
	let byName = exposureIndexes.get(exposures);
	if (!byName) {
		byName = new Map(exposures.map(exposure => [exposure.name, exposure]));
		exposureIndexes.set(exposures, byName);
	}
	const exposure = byName.get(publicName);
	if (!exposure) return directTarget;

	return { publicModuleId, publicName, moduleId: exposure.targetModuleId, memory: exposure.targetMemory, exposure };
}
