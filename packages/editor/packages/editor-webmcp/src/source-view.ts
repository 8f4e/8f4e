import type { CodeBlockGraphicData, EditorProjectSnapshot } from '@8f4e/editor-core';
import { createChildProjectGroupPath } from '@8f4e/language-spec';

export interface SourceView {
	code: string;
	/** One-based inclusive source ranges associate code with opaque editing handles. */
	blocks: Array<{ blockId: string; startLine: number; endLine: number }>;
	projectPath: string;
}

/** Read partial editor source without the file exporter's syntax validation or recursive expansion. */
export function createSourceView(snapshot: EditorProjectSnapshot, groupId?: string): SourceView {
	const handles = new Map(snapshot.blocks.map(({ blockId, block }) => [block, blockId]));
	const group = groupId === undefined ? undefined : snapshot.blocks.find(item => item.blockId === groupId)?.block;
	if (groupId !== undefined && !group)
		throw Object.assign(new Error('Read get_project for a current group blockId'), { code: 'block_not_found' });
	if (group && group.nestedProjectCodeBlocks === undefined)
		throw Object.assign(new Error('The selected block is not a project group'), { code: 'not_a_group' });
	const projectPath = group ? createChildProjectGroupPath(group.projectPath, group.name) : '';
	const directBlocks = group
		? group.nestedProjectCodeBlocks!
		: snapshot.blocks.filter(({ block }) => block.projectPath === '').map(({ block }) => block);
	const ordered = [...directBlocks].sort(
		(a, b) => a.gridX - b.gridX || a.gridY - b.gridY || a.creationIndex - b.creationIndex
	);
	const lines: string[] = [];
	const blocks: SourceView['blocks'] = [];
	const append = (block: CodeBlockGraphicData) => {
		if (lines.length && lines.at(-1) !== '') lines.push('');
		const startLine = lines.length + 1;
		lines.push(...(block.code.length ? block.code : ['']));
		blocks.push({ blockId: handles.get(block)!, startLine, endLine: lines.length });
	};
	if (group) {
		let closer = group.code.length - 1;
		while (closer >= 0 && group.code[closer].trim() === '') closer--;
		if (closer < 0 || !/^\s*groupEnd(?:\s|$)/.test(group.code[closer])) closer = group.code.length;
		lines.push(...group.code.slice(0, closer));
		for (const block of ordered) append(block);
		lines.push(...group.code.slice(closer));
	} else {
		lines.push('8f4e/v1');
		const executable = (block: CodeBlockGraphicData) =>
			block.blockType === 'module' || block.nestedProjectCodeBlocks !== undefined;
		for (const block of ordered.filter(block => !executable(block))) append(block);
		const entries = new Map<string, CodeBlockGraphicData[]>();
		for (const block of ordered.filter(executable)) {
			const entry = block.entry ?? 'main';
			const members = entries.get(entry) ?? [];
			members.push(block);
			entries.set(entry, members);
		}
		for (const [entry, members] of entries) {
			lines.push('', `entry ${entry}`);
			for (const block of members) append(block);
			lines.push('entryEnd');
		}
	}
	return { code: lines.join('\n'), blocks, projectPath };
}
