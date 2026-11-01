import type { State } from '@8f4e/editor-state-types';
import type { ProjectObjectModel } from '@8f4e/language-spec';
import convertGraphicDataToProjectStructure from './serializeCodeBlocks';

/**
 * Returns detached canonical project data for history, session persistence, compilation, and project export.
 * @param state Current editor state
 * @returns Project object model ready for session persistence, compilation, or `.8f4e` conversion
 */
export default function serializeToProject(state: State): ProjectObjectModel {
	const { codeBlockRendering } = state;
	return convertGraphicDataToProjectStructure(
		codeBlockRendering.rootProject.blocks,
		codeBlockRendering.rootProject.entries
	);
}
