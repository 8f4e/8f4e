import { gapCalculator } from '@8f4e/editor-state';
import type { CodeBlockGraphicData, State } from '@8f4e/editor-state-types';
import type { AssertionSite } from '@8f4e/language-spec';

export default function deriveAssertionMarkers(codeBlock: CodeBlockGraphicData, state: State) {
	if (state.compiler.isCompiling || codeBlock.disabled) return [];

	const sites = new Map<number, { site: AssertionSite; passed: boolean }>();
	for (const assertion of state.assertionResults) {
		const { site } = assertion;
		if (
			site.source ||
			site.projectBlockId !== codeBlock.creationIndex ||
			site.projectGroupPath !== codeBlock.projectPath ||
			site.codeBlockType !== codeBlock.blockType
		)
			continue;
		const previous = sites.get(site.siteId);
		if (previous) previous.passed &&= assertion.passed;
		else sites.set(site.siteId, { site, passed: assertion.passed });
	}

	return [...sites.values()].flatMap(({ site, passed }) => {
		const displayRow = codeBlock.displayModel.sourceLineIndexToDisplayRow[site.lineNumber];
		if (displayRow === undefined || codeBlock.displayModel.lines[displayRow].isPlaceholder) return [];
		return [
			{
				passed,
				x: state.viewport.vGrid,
				y: gapCalculator(displayRow, codeBlock.gaps) * state.viewport.hGrid,
				width: codeBlock.lineNumberColumnWidth * state.viewport.vGrid,
				height: state.viewport.hGrid,
			},
		];
	});
}
