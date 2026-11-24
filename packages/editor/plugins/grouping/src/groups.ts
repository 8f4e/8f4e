import { matchEditorDirectives } from '@8f4e/editor-state';
import type { EditorCodeBlock, ParsedDirectiveRecord, State } from '@8f4e/editor-state-types';

export interface Group {
	name: string;
	nonstick: boolean;
}

export function getGroup(directives: ParsedDirectiveRecord[]): Group | undefined {
	const directive = matchEditorDirectives(directives, [{ name: 'group' }]).find(record => record.args[0]);
	return directive ? { name: directive.args[0], nonstick: directive.args[1] === 'nonstick' } : undefined;
}

export function getGroupBlocks(state: State, block: EditorCodeBlock): EditorCodeBlock[] {
	const group = getGroup(block.parsedDirectives);
	return group
		? state.project.activeLevel.blocks.filter(candidate => getGroup(candidate.parsedDirectives)?.name === group.name)
		: [];
}
