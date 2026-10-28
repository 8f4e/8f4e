import type { CodeBlockGraphicData, EditorProjectSnapshot } from '@8f4e/editor-core';
import { createChildProjectGroupPath } from '@8f4e/language-spec';

export interface SourceView {
	code: string;
	/** One-based inclusive source ranges associate code with opaque editing handles. */
	blocks: Array<{ blockId: string; startLine: number; endLine: number }>;
	projectPath: string;
}

/** Read partial editor source without the file exporter's syntax validation or recursive expansion. */
export function createSourceView(snapshot: EditorProjectSnapshot): SourceView {
	const handles = new Map(snapshot.blocks.map(({ blockId, block }) => [block, blockId]));
	const projectPath = snapshot.projectPath;
	const group =
		projectPath === ''
			? undefined
			: snapshot.blocks.find(
					({ block }) =>
						block.nestedProjectCodeBlocks !== undefined &&
						createChildProjectGroupPath(block.projectPath, block.name) === projectPath
				)?.block;
	if (projectPath !== '' && !group) throw new Error('The currently expanded group is unavailable');
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
