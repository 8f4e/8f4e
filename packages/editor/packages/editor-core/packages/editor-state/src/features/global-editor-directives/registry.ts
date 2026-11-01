import type {
	CodeBlockGraphicData,
	CodeError,
	GlobalEditorDirectiveContext,
	GlobalEditorDirectiveDefinition,
	GlobalEditorDirectiveResolutionResult,
	ParsedGlobalEditorDirective,
	ResolvedGlobalEditorDirectives,
} from '@8f4e/editor-state-types';
import { createProjectModuleId } from '@8f4e/language-spec';
import configDirective from './config/plugin';
import modeDirective from './mode/plugin';
import { parseGlobalEditorDirectives } from './utils';

export const globalEditorDirectiveDefinitions: GlobalEditorDirectiveDefinition[] = [configDirective, modeDirective];

export function resolveGlobalEditorDirectives(
	codeBlocks: Pick<CodeBlockGraphicData, 'parsedDirectives' | 'projectPath' | 'creationIndex' | 'name' | 'blockType'>[],
	definitions: GlobalEditorDirectiveDefinition[] = globalEditorDirectiveDefinitions
): GlobalEditorDirectiveResolutionResult {
	const definitionMap = new Map(definitions.map(definition => [definition.name, definition]));
	const draft: {
		resolved: ResolvedGlobalEditorDirectives;
		errors: CodeError[];
	} = {
		resolved: {},
		errors: [],
	};

	for (const block of codeBlocks) {
		const directives: ParsedGlobalEditorDirective[] = parseGlobalEditorDirectives(block.parsedDirectives, definitions);
		const context: GlobalEditorDirectiveContext = {
			codeBlockId: block.creationIndex,
			moduleId:
				block.blockType === 'module' && block.name ? createProjectModuleId(block.projectPath, block.name) : undefined,
			blockType: block.blockType,
		};

		for (const directive of directives) {
			definitionMap.get(directive.name)?.apply?.(directive, draft, context);
		}
	}

	return {
		resolved: draft.resolved,
		errors: draft.errors,
	};
}
