import type { CodeBlockGraphicData } from '@8f4e/editor-state-types';
import type { ProjectBlock, ProjectObjectModel } from '@8f4e/language-spec';
import { tryParseProjectMemoryExposureLine } from '@8f4e/project-preparser';
import sortCodeBlocksByGridPosition from './sortCodeBlocksByGridPosition';

function createEmptyProject(): ProjectObjectModel {
	return {
		code: [],
		modules: [],
		functions: [],
		constants: [],
		prototypes: [],
		includes: [],
		notes: [],
		unknown: [],
		groups: [],
	};
}

/** Converts editor-owned live blocks directly into the canonical project collections. */
export default function convertGraphicDataToProjectStructure(codeBlocks: CodeBlockGraphicData[]): ProjectObjectModel {
	const project = createEmptyProject();

	for (const codeBlock of sortCodeBlocksByGridPosition(codeBlocks)) {
		if (codeBlock.isProjectScope) {
			project.code.push(...codeBlock.code);
			continue;
		}
		if (codeBlock.nestedProjectCodeBlocks !== undefined) {
			project.groups.push({
				...convertGraphicDataToProjectStructure(codeBlock.nestedProjectCodeBlocks),
				name: codeBlock.name,
				entry: codeBlock.entry!,
				code: codeBlock.code,
				exposures: codeBlock.code.flatMap(line => {
					const exposure = tryParseProjectMemoryExposureLine(line);
					return exposure ? [exposure] : [];
				}),
			});
			continue;
		}

		const block: ProjectBlock = {
			id: codeBlock.creationIndex,
			code: codeBlock.code,
			...(codeBlock.disabled ? { disabled: true } : {}),
		};

		if (codeBlock.blockType === 'module') {
			project.modules.push({ ...block, entry: codeBlock.entry! });
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
