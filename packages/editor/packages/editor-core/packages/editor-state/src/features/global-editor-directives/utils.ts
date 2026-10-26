import type {
	GlobalEditorDirectiveDefinition,
	ParsedDirectiveRecord,
	ParsedGlobalEditorDirective,
} from '@8f4e/editor-state-types';

export function createGlobalEditorDirectiveDefinition(
	name: string,
	apply: NonNullable<GlobalEditorDirectiveDefinition['apply']>
): GlobalEditorDirectiveDefinition {
	return {
		name,
		apply,
	};
}

export function parseGlobalEditorDirectives(
	parsedDirectives: ParsedDirectiveRecord[],
	definitions: GlobalEditorDirectiveDefinition[]
): ParsedGlobalEditorDirective[] {
	const definitionNames = new Set(definitions.map(definition => definition.name));

	return parsedDirectives
		.filter(directive => directive.prefix === '@' && definitionNames.has(directive.name))
		.map(directive => ({
			name: directive.name,
			args: directive.args,
			rawRow: directive.rawRow,
		}));
}
