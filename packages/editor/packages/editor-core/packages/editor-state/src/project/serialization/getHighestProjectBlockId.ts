import type { ProjectObjectModel } from '@8f4e/language-spec';

/** Find the highest block ID across the complete project, including nested groups. */
export default function getHighestProjectBlockId(project: ProjectObjectModel): number {
	return Math.max(
		-1,
		...[...project.functions, ...project.constants, ...project.includes, ...project.notes, ...project.unknown].map(
			block => block.id
		),
		...project.execution.map(block =>
			block.type === 'group' ? Math.max(block.id, getHighestProjectBlockId(block)) : block.id
		)
	);
}
