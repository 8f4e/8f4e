import { describe, expect, it } from 'vitest';
import buildDisplayModel from '~/features/code-blocks/buildDisplayModel';
import { createMockCodeBlock, createMockState } from '~/pureHelpers/testingUtils/testUtils';
import updateBlockHighlightsGraphicData from './updateGraphicData';

describe('updateBlockHighlightsGraphicData', () => {
	it('highlights only lines between block start and end instructions', () => {
		const graphicData = createMockCodeBlock({
			code: ['if condition', 'add', 'store', 'ifEnd'],
			width: 200,
			lineNumberColumnWidth: 1,
			gaps: new Map(),
		});
		const state = createMockState({
			viewport: {
				vGrid: 10,
				hGrid: 20,
			},
		});

		updateBlockHighlightsGraphicData(graphicData, state);

		expect(graphicData.widgets.blockHighlights).toEqual([
			{
				x: 30,
				y: 20,
				width: 170,
				height: 40,
				color: 'codeBlockHighlightLevel1',
			},
		]);
	});

	it('does not render a highlight when no lines exist between block boundaries', () => {
		const graphicData = createMockCodeBlock({
			code: ['if condition', 'ifEnd'],
		});
		const state = createMockState();

		updateBlockHighlightsGraphicData(graphicData, state);

		expect(graphicData.widgets.blockHighlights).toEqual([]);
	});

	it('removes highlights below @hide and restores them when expanded for editing', () => {
		const code = ['module foo', '; @hide', 'if condition', 'add', 'ifEnd', 'moduleEnd'];
		const graphicData = createMockCodeBlock({ code });
		const state = createMockState();

		updateBlockHighlightsGraphicData(graphicData, state);
		const expandedHighlights = [...graphicData.widgets.blockHighlights];
		expect(expandedHighlights).toHaveLength(1);

		graphicData.displayModel = buildDisplayModel(code, { hideAfterSourceLineIndex: 1 });
		updateBlockHighlightsGraphicData(graphicData, state);
		expect(graphicData.widgets.blockHighlights).toEqual([]);

		graphicData.displayModel = buildDisplayModel(code, { hideAfterSourceLineIndex: 1, isExpandedForEditing: true });
		updateBlockHighlightsGraphicData(graphicData, state);
		expect(graphicData.widgets.blockHighlights).toEqual(expandedHighlights);
	});

	it('clips a highlight crossing @hide before the collapsed placeholder', () => {
		const code = ['if condition', 'add', '; @hide', 'store', 'ifEnd'];
		const graphicData = createMockCodeBlock({
			code,
			displayModel: buildDisplayModel(code, { hideAfterSourceLineIndex: 2 }),
			width: 200,
			lineNumberColumnWidth: 1,
		});
		const state = createMockState({ viewport: { vGrid: 10, hGrid: 20 } });

		updateBlockHighlightsGraphicData(graphicData, state);

		expect(graphicData.widgets.blockHighlights).toEqual([
			{ x: 30, y: 20, width: 170, height: 40, color: 'codeBlockHighlightLevel1' },
		]);
	});
});
