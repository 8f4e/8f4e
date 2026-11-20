import type { CodeBlockGraphicData, State } from '@8f4e/editor-state-types';
import type { ProjectMemoryExposure, ResolvedProjectMemoryExposure } from '@8f4e/language-spec';
import { tryParseProjectMemoryExposureLine } from '@8f4e/project-preparser';
import getCodeBlockMemoryScope from './getCodeBlockMemoryScope';

type ExposureRow = Pick<ProjectMemoryExposure, 'name' | 'lineNumber'>;

const sourceRowsByBlock = new WeakMap<CodeBlockGraphicData, ExposureRow[]>();

/** Capture exposure rows during the source pass, not during layout. */
export function updateProjectGroupMemoryExposureRows(block: CodeBlockGraphicData): void {
	if (block.childProject === undefined) return;
	sourceRowsByBlock.set(
		block,
		block.code.flatMap((line, lineNumber) => {
			const exposure = tryParseProjectMemoryExposureLine(line);
			return exposure ? [{ name: exposure.name, lineNumber }] : [];
		})
	);
}

/** Use compiler-resolved targets and rows, following edits to the rows while recompilation is pending. */
export function getProjectGroupMemoryExposures(
	block: CodeBlockGraphicData,
	state: Pick<State, 'compiler'>
): readonly ResolvedProjectMemoryExposure[] {
	const scope = getCodeBlockMemoryScope(block);
	if (scope.kind !== 'project') return [];
	const accepted = state.compiler.result.projectMemoryExposuresByGroupPath[scope.groupPath];
	if (!accepted?.length) return [];
	const currentRows = sourceRowsByBlock.get(block);
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
