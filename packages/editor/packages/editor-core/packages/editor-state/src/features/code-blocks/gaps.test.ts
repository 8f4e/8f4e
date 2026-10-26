import { describe, expect, it } from 'vitest';
import type { DirectiveDerivedState } from './features/directives/registry';
import { createVerticalSpaceAfterSourceLineAdder } from './features/directives/verticalSpaceAfterSourceLine';
import gaps from './gaps';
import { createCodeBlockGraphicData } from './utils/createCodeBlockGraphicData';

describe('gaps', () => {
	it('inserts directive gaps using display rows', async () => {
		const directiveState: DirectiveDerivedState = {
			blockState: { disabled: false, isHome: false, isFavorite: false },
			displayState: {},
			displayModel: {
				lines: [
					{ sourceLineIndex: 0, text: 'module foo' },
					{ sourceLineIndex: 1, text: '; @plot buffer' },
					{ sourceLineIndex: 3, text: 'moduleEnd' },
				],
				displayRowToSourceLineIndex: [0, 1, 3],
				sourceLineIndexToDisplayRow: [0, 1, undefined, 2],
				isCollapsed: false,
			},
			addVerticalSpaceAfterSourceLine: createVerticalSpaceAfterSourceLineAdder(),
			layoutCallbacks: [],
		};
		directiveState.addVerticalSpaceAfterSourceLine({ sourceLineIndex: 1, heightInRows: 8 });
		const graphicData = createCodeBlockGraphicData({ code: ['module foo', '; @plot buffer', 'push 1', 'moduleEnd'] });

		gaps(graphicData, directiveState);

		expect(graphicData.gaps.get(1)).toEqual({ size: 8 });
	});

	it('adds multiple vertical-space requests on the same display row', async () => {
		const directiveState: DirectiveDerivedState = {
			blockState: { disabled: false, isHome: false, isFavorite: false },
			displayState: {},
			displayModel: {
				lines: [
					{ sourceLineIndex: 0, text: 'module foo' },
					{ sourceLineIndex: 1, text: 'shape sharedState' },
					{ sourceLineIndex: 2, text: 'moduleEnd' },
				],
				displayRowToSourceLineIndex: [0, 1, 2],
				sourceLineIndexToDisplayRow: [0, 1, 2],
				isCollapsed: false,
			},
			addVerticalSpaceAfterSourceLine: createVerticalSpaceAfterSourceLineAdder(),
			layoutCallbacks: [],
		};
		directiveState.addVerticalSpaceAfterSourceLine({ sourceLineIndex: 1, heightInRows: 2 });
		directiveState.addVerticalSpaceAfterSourceLine({ sourceLineIndex: 1, heightInRows: 3 });
		const graphicData = createCodeBlockGraphicData({ code: ['module foo', 'shape sharedState', 'moduleEnd'] });

		gaps(graphicData, directiveState);

		expect(graphicData.gaps.get(1)).toEqual({ size: 5 });
	});

	it('adds error gaps to requested vertical space on the same display row', async () => {
		const directiveState: DirectiveDerivedState = {
			blockState: { disabled: false, isHome: false, isFavorite: false },
			displayState: {},
			displayModel: {
				lines: [
					{ sourceLineIndex: 0, text: 'module foo' },
					{ sourceLineIndex: 1, text: 'shape sharedState' },
					{ sourceLineIndex: 2, text: 'moduleEnd' },
				],
				displayRowToSourceLineIndex: [0, 1, 2],
				sourceLineIndexToDisplayRow: [0, 1, 2],
				isCollapsed: false,
			},
			addVerticalSpaceAfterSourceLine: createVerticalSpaceAfterSourceLineAdder(),
			layoutCallbacks: [],
		};
		directiveState.addVerticalSpaceAfterSourceLine({ sourceLineIndex: 1, heightInRows: 2 });
		const graphicData = createCodeBlockGraphicData({
			code: ['module foo', 'shape sharedState', 'moduleEnd'],
			widgets: {
				blockHighlights: [],
				inputs: [],
				outputs: [],
				debuggers: [],
				sliders: [],
				crossfades: [],
				arrayPlotters: [],
				arrayBars: [],
				arrayMeters: [],
				infoPanels: [],
				errorMessages: [{ message: ['Error', 'detail', 'more'], x: 0, y: 0, lineNumber: 1 }],
			},
		});

		gaps(graphicData, directiveState);

		expect(graphicData.gaps.get(1)).toEqual({ size: 5 });
	});

	it('skips gaps for source lines hidden from the display model', async () => {
		const directiveState: DirectiveDerivedState = {
			blockState: { disabled: false, isHome: false, isFavorite: false },
			displayState: {},
			displayModel: {
				lines: [
					{ sourceLineIndex: 0, text: 'module foo' },
					{ sourceLineIndex: 3, text: 'moduleEnd' },
				],
				displayRowToSourceLineIndex: [0, 3],
				sourceLineIndexToDisplayRow: [0, undefined, undefined, 1],
				isCollapsed: true,
			},
			addVerticalSpaceAfterSourceLine: createVerticalSpaceAfterSourceLineAdder(),
			layoutCallbacks: [],
		};
		directiveState.addVerticalSpaceAfterSourceLine({ sourceLineIndex: 1, heightInRows: 8 });
		const graphicData = createCodeBlockGraphicData({
			code: ['module foo', '; @plot buffer', 'push 1', 'moduleEnd'],
			widgets: {
				blockHighlights: [],
				inputs: [],
				outputs: [],
				debuggers: [],
				sliders: [],
				crossfades: [],
				arrayPlotters: [],
				arrayBars: [],
				arrayMeters: [],
				infoPanels: [],
				errorMessages: [{ message: ['Error'], x: 0, y: 0, lineNumber: 2 }],
			},
		});

		gaps(graphicData, directiveState);

		expect(graphicData.gaps.size).toBe(0);
	});
});
