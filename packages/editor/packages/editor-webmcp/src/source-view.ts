import type { CodeBlockGraphicData, Editor } from '@8f4e/editor-core';
import { createChildProjectGroupPath } from '@8f4e/language-spec';

function currentGroup(state: Editor['state']): CodeBlockGraphicData | undefined {
	const { rootCodeBlocks, codeBlocks } = state.codeBlockRendering;
	if (rootCodeBlocks === codeBlocks) return undefined;
	const find = (blocks: CodeBlockGraphicData[]): CodeBlockGraphicData | undefined => {
		for (const block of blocks) {
			if (block.nestedProjectCodeBlocks === codeBlocks) return block;
			const found = block.nestedProjectCodeBlocks && find(block.nestedProjectCodeBlocks);
			if (found) return found;
		}
	};
	const group = find(rootCodeBlocks);
	if (!group) throw new Error('The currently expanded group is unavailable');
	return group;
}

export function getCurrentProjectPath(state: Editor['state']): string {
	const group = currentGroup(state);
	return group ? createChildProjectGroupPath(group.projectPath, group.name) : '';
}

function groupCloserIndex(code: readonly string[]): number {
	let closer = code.length - 1;
	while (closer >= 0 && code[closer].trim() === '') closer--;
	return closer >= 0 && /^\s*groupEnd(?:\s|$)/.test(code[closer]) ? closer : code.length;
}

/** Read one source level synchronously from the live editor, without recursive file export. */
export function createSourceView(state: Editor['state']): string {
	const group = currentGroup(state);
	const directBlocks = state.codeBlockRendering.codeBlocks;
	const ordered = [...directBlocks].sort(
		(a, b) => a.gridX - b.gridX || a.gridY - b.gridY || a.creationIndex - b.creationIndex
	);
	const lines: string[] = [];
	const append = (block: CodeBlockGraphicData) => {
		if (lines.length && lines.at(-1) !== '') lines.push('');
		if (block.nestedProjectCodeBlocks === undefined) {
			lines.push(...(block.code.length ? block.code : ['']));
		} else {
			const closer = groupCloserIndex(block.code);
			lines.push(...block.code.slice(0, closer));
			for (const entry of block.projectEntries!) lines.push(`entry ${entry}`, 'entryEnd');
			lines.push(...block.code.slice(closer));
		}
	};
	let closer: number | undefined;
	if (group) {
		closer = groupCloserIndex(group.code);
		lines.push(...group.code.slice(0, closer));
	} else lines.push('8f4e/v1');

	const executable = (block: CodeBlockGraphicData) =>
		block.blockType === 'module' || block.nestedProjectCodeBlocks !== undefined;
	for (const block of ordered.filter(block => !executable(block))) append(block);
	let current: string | undefined;
	const emitted = new Set<string>();
	const close = () => {
		if (current !== undefined) lines.push('entryEnd');
		current = undefined;
	};
	for (const block of ordered.filter(executable)) {
		if (current !== block.entry) {
			close();
			current = block.entry!;
			lines.push('', `entry ${current}`);
			emitted.add(current);
		}
		append(block);
	}
	close();
	for (const entry of group ? group.projectEntries! : state.codeBlockRendering.rootProjectEntries) {
		if (!emitted.has(entry)) lines.push('', `entry ${entry}`, 'entryEnd');
	}
	if (group) lines.push(...group.code.slice(closer));
	return lines.join('\n');
}
