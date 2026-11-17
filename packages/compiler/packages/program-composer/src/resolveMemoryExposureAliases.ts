import type { ComposedProgram } from './types';

/** Resolves forwarded child-group exposures to their backing declarations without allocating memory. */
export function resolveMemoryExposureAliases(program: ComposedProgram): void {
	const aliases = new Map(program.memoryAliases);
	// Scopes are collected before their children, so resolve descendants before their parents.
	for (const [groupPath, exposures] of [...aliases].reverse()) {
		aliases.set(
			groupPath,
			new Map(
				[...exposures].map(([name, target]) => [
					name,
					aliases.get(target.targetModuleId)?.get(target.targetMemoryId) ?? target,
				])
			)
		);
	}
	program.memoryAliases = aliases;
	program.memoryExposures = program.memoryExposures.map(exposure => {
		const target = aliases.get(exposure.groupPath)!.get(exposure.name)!;
		return { ...exposure, targetModuleId: target.targetModuleId, targetMemoryName: target.targetMemoryId };
	});
}
