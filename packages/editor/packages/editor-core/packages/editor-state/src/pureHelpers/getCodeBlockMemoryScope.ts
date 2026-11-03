import type { CodeBlockGraphicData } from '@8f4e/editor-state-types';
import { createChildProjectGroupPath } from '@8f4e/language-spec';
import getCodeBlockModuleId from './getCodeBlockModuleId';
import type { MemoryScope } from './resolveMemoryTarget';

/** Converts an editor block into the scope in which its memory references are evaluated. */
export default function getCodeBlockMemoryScope(
	codeBlock: Pick<CodeBlockGraphicData, 'name' | 'projectPath' | 'childProject'>
): MemoryScope {
	return codeBlock.childProject === undefined
		? { kind: 'module', moduleId: getCodeBlockModuleId(codeBlock) }
		: { kind: 'project', groupPath: createChildProjectGroupPath(codeBlock.projectPath, codeBlock.name) };
}
