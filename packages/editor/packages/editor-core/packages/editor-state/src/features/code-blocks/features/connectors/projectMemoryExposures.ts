import type { CodeBlockGraphicData, State } from '@8f4e/editor-state-types';
import type { ResolvedProjectMemoryExposure } from '@8f4e/language-spec';
import { tryParseProjectMemoryExposureLine } from '@8f4e/project-preparser';
import gapCalculator from '~/features/code-editing/gapCalculator';
import getCodeBlockMemoryScope from '~/pureHelpers/getCodeBlockMemoryScope';
import resolveMemoryTarget from '~/pureHelpers/resolveMemoryTarget';

export interface ProjectMemoryExposureConnector {
	exposure: ResolvedProjectMemoryExposure;
	row: number;
}

/** Matches the group block's source rows to compiler-resolved exposure targets. */
export function getProjectMemoryExposureConnectors(
	graphicData: CodeBlockGraphicData,
	state: State
): ProjectMemoryExposureConnector[] {
	if (graphicData.nestedProjectCodeBlocks === undefined) {
		return [];
	}

	const scope = getCodeBlockMemoryScope(graphicData);
	return graphicData.code.flatMap((line, sourceLineIndex) => {
		const parsed = tryParseProjectMemoryExposureLine(line);
		const exposure = parsed ? resolveMemoryTarget(state, scope, parsed.name)?.exposure : undefined;
		return exposure ? [{ exposure, row: gapCalculator(sourceLineIndex, graphicData.gaps) }] : [];
	});
}
