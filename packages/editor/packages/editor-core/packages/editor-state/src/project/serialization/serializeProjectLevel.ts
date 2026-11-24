import type { ProjectLevel } from '@8f4e/editor-state-types';
import type { ProjectBlock, ProjectObjectModel } from '@8f4e/language-spec';
import { createProjectObjectModel } from '@8f4e/language-spec';
import compareCodeBlocksByPosition from '../blocks/compareCodeBlocksByPosition';

/** Projects settled editor levels into detached compiler/file data in canonical grid/creation order. */
export default function serializeProjectLevel(level: ProjectLevel): ProjectObjectModel {
	const project = createProjectObjectModel();
	project.entries = [...level.entries];
	const sortedBlocks = [...level.blocks].sort(compareCodeBlocksByPosition);

	for (const codeBlock of sortedBlocks) {
		if (codeBlock.isProjectScope) {
			project.code.push(...codeBlock.code);
			continue;
		}
		if (codeBlock.childLevel !== undefined) {
			project.execution.push({
				...serializeProjectLevel(codeBlock.childLevel),
				type: 'group',
				id: codeBlock.creationIndex,
				name: codeBlock.name,
				entry: codeBlock.entry!,

				code: [...codeBlock.code],
				exposures: codeBlock.projectMemoryExposures?.map(exposure => ({ ...exposure })) ?? [],
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
		} else if (codeBlock.blockType === 'function') {
			project.functions.push(block);
		} else if (codeBlock.blockType === 'constants') {
			project.constants.push(block);
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
