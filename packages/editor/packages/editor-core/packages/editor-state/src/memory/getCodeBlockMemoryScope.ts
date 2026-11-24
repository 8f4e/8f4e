import type { EditorCodeBlock } from '@8f4e/editor-state-types';
import { createChildProjectGroupPath } from '@8f4e/language-spec';
import getCodeBlockModuleId from '../compiler-metadata/getCodeBlockModuleId';
import type { MemoryScope } from './resolveMemoryTarget';

/** Converts an editor block into the scope in which its memory references are evaluated. */
export default function getCodeBlockMemoryScope(
	codeBlock: Pick<EditorCodeBlock, 'name' | 'projectPath' | 'childLevel'>
): MemoryScope {
	return codeBlock.childLevel === undefined
		? { kind: 'module', moduleId: getCodeBlockModuleId(codeBlock) }
		: { kind: 'project', groupPath: createChildProjectGroupPath(codeBlock.projectPath, codeBlock.name) };
}
