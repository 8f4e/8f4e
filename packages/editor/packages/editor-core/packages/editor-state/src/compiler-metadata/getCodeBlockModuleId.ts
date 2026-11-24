import type { CodeBlockGraphicData } from '@8f4e/editor-state-types';
import { createProjectModuleId, type ProjectModuleId } from '@8f4e/language-spec';

/** Derives the compiler module identity when a generic editor code block is known to contain a module. */
export default function getCodeBlockModuleId(
	codeBlock: Pick<CodeBlockGraphicData, 'projectPath' | 'name'>
): ProjectModuleId {
	return createProjectModuleId(codeBlock.projectPath, codeBlock.name);
}
