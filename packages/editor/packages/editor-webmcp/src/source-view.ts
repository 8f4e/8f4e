import type { CodeBlockGraphicData, Editor } from '@8f4e/editor-core';
import { findParentProjectLevel } from '@8f4e/editor-state';

function currentGroup(state: Editor['state']): CodeBlockGraphicData | undefined {
	const { rootProject, currentProject } = state.codeBlockRendering;
	if (rootProject === currentProject) return undefined;
	const parent = findParentProjectLevel(rootProject, currentProject);
	const group = parent?.blocks.find(block => block.childProject === currentProject);
	if (!group) throw new Error('The currently expanded group is unavailable');
	return group;
}

export function getCurrentProjectPath(state: Editor['state']): string {
	return state.codeBlockRendering.currentProject.path;
}

/** Read one source level synchronously from the live editor, without recursive file export. */
export function createSourceView(state: Editor['state']): string {
	const group = currentGroup(state);
	const directBlocks = state.codeBlockRendering.currentProject.blocks;
	const ordered = [...directBlocks].sort(
		(a, b) => a.gridX - b.gridX || a.gridY - b.gridY || a.creationIndex - b.creationIndex
	);
	const lines: string[] = [];
	const append = (block: CodeBlockGraphicData) => {
		if (lines.length && lines.at(-1) !== '') lines.push('');
		lines.push(...(block.code.length ? block.code : ['']));
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
			block.blockType === 'module' || block.childProject !== undefined;
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
	return lines.join('\n');
}
