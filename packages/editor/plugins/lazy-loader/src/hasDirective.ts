import { parseBlockDirectives } from '@8f4e/editor-state';
import type { ProjectObjectModel } from '@8f4e/language-spec';

/** Match directive records without loading their implementations, including sources in nested groups. */
export function hasDirective(project: ProjectObjectModel, name: string): boolean {
	const sources = [
		project.code,
		...[
			...project.modules,
			...project.functions,
			...project.constants,
			...project.prototypes,
			...project.includes,
			...project.notes,
			...project.unknown,
		].map(block => block.code),
	];
	return (
		sources.some(code => parseBlockDirectives(code).some(directive => directive.name === name)) ||
		project.groups.some(group => hasDirective(group, name))
	);
}
