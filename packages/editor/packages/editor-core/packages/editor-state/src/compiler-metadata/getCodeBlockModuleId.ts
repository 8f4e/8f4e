import type { EditorCodeBlock } from '@8f4e/editor-state-types';
import { createProjectModuleId, type ProjectModuleId } from '@8f4e/language-spec';

/** Derives the compiler module identity when a generic editor code block is known to contain a module. */
export default function getCodeBlockModuleId(
	codeBlock: Pick<EditorCodeBlock, 'projectPath' | 'name'>
): ProjectModuleId {
	return createProjectModuleId(codeBlock.projectPath, codeBlock.name);
}
