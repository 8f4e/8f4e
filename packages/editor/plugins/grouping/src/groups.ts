import type { CodeBlockGraphicData, ParsedDirectiveRecord, State } from '@8f4e/editor-state-types';

export interface Group {
	name: string;
	nonstick: boolean;
}

export function getGroup(directives: ParsedDirectiveRecord[]): Group | undefined {
	const directive = directives.find(record => record.name === 'group' && !record.isTrailing && record.args[0]);
	return directive ? { name: directive.args[0], nonstick: directive.args[1] === 'nonstick' } : undefined;
}

export function getGroupBlocks(state: State, block: CodeBlockGraphicData): CodeBlockGraphicData[] {
	const group = getGroup(block.parsedDirectives);
	return group
		? state.codeBlockRendering.codeBlocks.filter(candidate => getGroup(candidate.parsedDirectives)?.name === group.name)
		: [];
}
