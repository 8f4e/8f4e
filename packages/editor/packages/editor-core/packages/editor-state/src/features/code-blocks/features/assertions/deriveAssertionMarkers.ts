import type { CodeBlockGraphicData, State } from '@8f4e/editor-state-types';
import type { AssertionSite } from '@8f4e/language-spec';
import gapCalculator from '../../../code-editing/gapCalculator';
import isAssertionForCodeBlock from './isAssertionForCodeBlock';

export default function deriveAssertionMarkers(
	codeBlock: CodeBlockGraphicData,
	state: State
): CodeBlockGraphicData['widgets']['assertions'] {
	if (state.compiler.isCompiling || codeBlock.disabled) return [];

	const sites = new Map<number, { site: AssertionSite; passed: boolean }>();
	for (const assertion of state.assertionResults) {
		const { site } = assertion;
		if (!isAssertionForCodeBlock(site, codeBlock)) continue;
		const previous = sites.get(site.siteId);
		if (previous) previous.passed &&= assertion.passed;
		else sites.set(site.siteId, { site, passed: assertion.passed });
	}

	return [...sites.values()].flatMap(({ site, passed }) => {
		const displayRow = codeBlock.displayModel.sourceLineIndexToDisplayRow[site.lineNumber];
		if (displayRow === undefined || codeBlock.displayModel.lines[displayRow].isPlaceholder) return [];
		return [
			{
				lineNumber: site.lineNumber,
				passed,
				x: state.viewport.vGrid,
				y: gapCalculator(displayRow, codeBlock.gaps) * state.viewport.hGrid,
				width: codeBlock.lineNumberColumnWidth * state.viewport.vGrid,
				height: state.viewport.hGrid,
			},
		];
	});
}
