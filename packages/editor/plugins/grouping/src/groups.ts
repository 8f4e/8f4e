import type { CodeBlockGraphicData, EditorDirectiveDefinition, State } from '@8f4e/editor-state-types';

export interface Group {
	name: string;
	nonstick: boolean;
}

export const groupDirective: EditorDirectiveDefinition = { name: 'group' };

export function getGroup(block: CodeBlockGraphicData): Group | undefined {
	const directive = block.parsedDirectives.find(
		record => record.name === 'group' && !record.isTrailing && record.args[0]
	);
	return directive ? { name: directive.args[0], nonstick: directive.args[1] === 'nonstick' } : undefined;
}

export function getGroupBlocks(state: State, block: CodeBlockGraphicData): CodeBlockGraphicData[] {
	const group = getGroup(block);
	return group ? state.codeBlockRendering.codeBlocks.filter(candidate => getGroup(candidate)?.name === group.name) : [];
}
