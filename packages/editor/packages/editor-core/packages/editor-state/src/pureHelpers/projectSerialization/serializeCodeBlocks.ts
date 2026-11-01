import type { CodeBlockGraphicData } from '@8f4e/editor-state-types';
import type { ProjectBlock, ProjectEntryName, ProjectObjectModel } from '@8f4e/language-spec';
import { createProjectObjectModel } from '@8f4e/language-spec';
import { tryParseProjectMemoryExposureLine } from '@8f4e/project-preparser';
import compareCodeBlocksByPosition from '../compareCodeBlocksByPosition';

/** Returns detached project data in canonical key and grid/creation order, recursively through project groups. */
export default function convertGraphicDataToProjectStructure(
	codeBlocks: CodeBlockGraphicData[],
	entries: readonly ProjectEntryName[] = []
): ProjectObjectModel {
	const project = createProjectObjectModel();
	project.entries = [...entries];
	const sortedBlocks = [...codeBlocks].sort(compareCodeBlocksByPosition);

	for (const codeBlock of sortedBlocks) {
		if (codeBlock.isProjectScope) {
			project.code.push(...codeBlock.code);
			continue;
		}
		if (codeBlock.childProject !== undefined) {
			if (!project.entries.includes(codeBlock.entry!)) project.entries.push(codeBlock.entry!);
			project.execution.push({
				...convertGraphicDataToProjectStructure(codeBlock.childProject.blocks, codeBlock.childProject.entries),
				type: 'group',
				id: codeBlock.creationIndex,
				name: codeBlock.name,
				entry: codeBlock.entry!,

				code: [...codeBlock.code],
				exposures: codeBlock.code.flatMap(line => {
					const exposure = tryParseProjectMemoryExposureLine(line);
					return exposure ? [exposure] : [];
				}),
			});
			continue;
		}

		const block: ProjectBlock = {
			id: codeBlock.creationIndex,
			code: [...codeBlock.code],
			...(codeBlock.disabled ? { disabled: true } : {}),
		};

		if (codeBlock.blockType === 'module') {
			project.execution.push({ ...block, type: 'module', entry: codeBlock.entry! });
			if (!project.entries.includes(codeBlock.entry!)) project.entries.push(codeBlock.entry!);
		} else if (codeBlock.blockType === 'function') {
			project.functions.push(block);
		} else if (codeBlock.blockType === 'constants') {
			project.constants.push(block);
		} else if (codeBlock.blockType === 'prototype') {
			project.prototypes.push(block);
		} else if (codeBlock.blockType === 'includes') {
			project.includes.push(block);
		} else if (codeBlock.blockType === 'note') {
			project.notes.push(block);
		} else {
			project.unknown.push(block);
		}
	}

	return project;
}
