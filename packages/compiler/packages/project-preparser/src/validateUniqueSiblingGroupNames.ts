import { syntaxErrorAt } from '@8f4e/compiler-diagnostics';
import {
	createChildProjectGroupPath,
	getProjectGroups,
	type ProjectGroupPath,
	type ProjectObjectModel,
	ROOT_PROJECT_GROUP_PATH,
} from '@8f4e/language-spec';
import { SyntaxErrorCode } from '@8f4e/tokenizer';

/** Reject duplicate sibling group names in an authored model before using name-based project paths. */
export function validateUniqueSiblingGroupNames(
	project: ProjectObjectModel,
	projectPath: ProjectGroupPath = ROOT_PROJECT_GROUP_PATH
): void {
	const names = new Set<string>();
	for (const group of getProjectGroups(project)) {
		if (names.has(group.name)) {
			throw syntaxErrorAt(
				SyntaxErrorCode.INVALID_BLOCK_STRUCTURE,
				`Duplicate sibling group "${group.name}"`,
				{ kind: 'block', projectBlockId: group.id, projectGroupPath: projectPath },
				{
					lineNumber: Math.max(
						0,
						group.code.findIndex(line => line.trim() !== '')
					),
					instruction: 'group',
				}
			);
		}
		names.add(group.name);
		validateUniqueSiblingGroupNames(group, createChildProjectGroupPath(projectPath, group.name));
	}
}
