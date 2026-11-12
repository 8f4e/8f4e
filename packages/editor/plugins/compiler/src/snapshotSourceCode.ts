import type { ProjectObjectModel } from '@8f4e/language-spec';

/** Retains the exact editor sources used by asynchronous compilation, including modules/functions in groups. */
export function snapshotSourceCode(project: ProjectObjectModel): Record<number, readonly string[]> {
	const sources: Record<number, readonly string[]> = {};
	const visit = (level: ProjectObjectModel) => {
		for (const block of level.functions) sources[block.id] = [...block.code];
		for (const block of level.execution) {
			if (block.type === 'group') visit(block);
			else sources[block.id] = [...block.code];
		}
	};
	visit(project);
	return sources;
}
