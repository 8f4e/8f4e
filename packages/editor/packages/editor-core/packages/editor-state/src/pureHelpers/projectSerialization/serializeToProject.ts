import type { State } from '@8f4e/editor-state-types';
import type { ProjectObjectModel } from '@8f4e/language-spec';
import serializeProjectLevel from './serializeProjectLevel';

/**
 * Returns detached canonical project data for history, session persistence, compilation, and project export.
 * @param state Current editor state
 * @returns Project object model ready for session persistence, compilation, or `.8f4e` conversion
 */
export default function serializeToProject(state: State): ProjectObjectModel {
	const { codeBlockRendering } = state;
	return serializeProjectLevel(codeBlockRendering.rootProject);
}
