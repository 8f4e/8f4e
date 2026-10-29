import type { ParsedDirectiveRecord } from '@8f4e/editor-core';
import { parseBlockDirectives } from '@8f4e/editor-state';
import type { ProjectObjectModel } from '@8f4e/language-spec';

/** Match directive records without loading their implementations, including sources in nested groups. */
function someDirective(project: ProjectObjectModel, matches: (directive: ParsedDirectiveRecord) => boolean): boolean {
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
		sources.some(code => parseBlockDirectives(code).some(matches)) ||
		project.groups.some(group => someDirective(group, matches))
	);
}

export function hasDirective(project: ProjectObjectModel, name: string): boolean {
	return someDirective(project, directive => directive.name === name);
}

/** Match a config root without requiring its lazy plugin's schema to be installed. */
export function hasConfig(project: ProjectObjectModel, root: string): boolean {
	return someDirective(
		project,
		directive =>
			directive.name === 'config' && (directive.args[0] === root || directive.args[0]?.startsWith(`${root}.`) === true)
	);
}
