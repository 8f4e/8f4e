import type {
	CodeBlockType,
	CodeError,
	GlobalEditorDirectiveContext,
	GlobalEditorDirectiveDefinition,
	GlobalEditorDirectiveResolutionResult,
	ParsedDirectiveRecord,
	ParsedGlobalEditorDirective,
	ResolvedGlobalEditorDirectives,
} from '@8f4e/editor-state-types';
import { createProjectModuleId, type ProjectGroupPath } from '@8f4e/language-spec';
import configDirective from './config/plugin';
import { parseGlobalEditorDirectives } from './utils';

export const globalEditorDirectiveDefinitions: GlobalEditorDirectiveDefinition[] = [configDirective];

export function resolveGlobalEditorDirectives(
	codeBlocks: {
		parsedDirectives: ParsedDirectiveRecord[];
		projectPath: ProjectGroupPath;
		creationIndex?: number;
		name?: string;
		blockType?: CodeBlockType;
	}[],
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

	for (let blockIndex = 0; blockIndex < codeBlocks.length; blockIndex++) {
		const block = codeBlocks[blockIndex];
		const directives: ParsedGlobalEditorDirective[] = parseGlobalEditorDirectives(block.parsedDirectives, definitions);
		const codeBlockId = block.creationIndex ?? blockIndex;
		const context: GlobalEditorDirectiveContext = {
			codeBlockId,
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
