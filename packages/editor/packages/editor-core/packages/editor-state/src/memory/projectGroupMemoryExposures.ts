import type { EditorCodeBlock, State } from '@8f4e/editor-state-types';
import type { ProjectMemoryExposure, ResolvedProjectMemoryExposure } from '@8f4e/language-spec';
import { tryParseProjectMemoryExposureLine } from '@8f4e/project-preparser';
import getCodeBlockMemoryScope from './getCodeBlockMemoryScope';

/** Collect complete exposure declarations during source preparation for layout and serialization. */
export function updateProjectGroupMemoryExposureDeclarations(block: EditorCodeBlock): void {
	if (block.childLevel === undefined) return;
	block.projectMemoryExposures = block.code.flatMap((line, lineNumber): ProjectMemoryExposure[] => {
		const exposure = tryParseProjectMemoryExposureLine(line);
		return exposure ? [{ ...exposure, lineNumber }] : [];
	});
}

/** Use compiler-resolved targets and rows, following edits to the rows while recompilation is pending. */
export function getProjectGroupMemoryExposures(
	block: EditorCodeBlock,
	state: Pick<State, 'compiler'>
): readonly ResolvedProjectMemoryExposure[] {
	const scope = getCodeBlockMemoryScope(block);
	if (scope.kind !== 'project') return [];
	const accepted = state.compiler.result.projectMemoryExposuresByGroupPath[scope.groupPath];
	if (!accepted?.length) return [];
	const currentRows = block.projectMemoryExposures;
	if (
		!currentRows ||
		(currentRows.length === accepted.length &&
			currentRows.every(
				({ name, lineNumber }, index) => name === accepted[index].name && lineNumber === accepted[index].lineNumber
			))
	) {
		return accepted;
	}

	const acceptedByName = new Map(accepted.map(exposure => [exposure.name, exposure]));
	return currentRows.flatMap(({ name, lineNumber }) => {
		const exposure = acceptedByName.get(name);
		return exposure ? [{ ...exposure, lineNumber }] : [];
	});
}
