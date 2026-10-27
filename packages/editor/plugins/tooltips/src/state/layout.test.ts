import { createMockCodeBlock, createMockState } from '@8f4e/editor-state-testing';
import { describe, expect, it } from 'vitest';
import type { SelectedLineTooltipContent } from '../types';
import { createEmptyTooltipState, getTooltipState } from './layout';

const content: SelectedLineTooltipContent = {
	text: ['before [int=1]', 'after: [int=1]'],
	characters: [],
	colors: [],
	lineCount: 2,
	widthChars: 14,
	highlightTargets: [],
	liveValueTargets: [],
};

describe('tooltip layout', () => {
	it('starts animation for a new selected line and preserves it across content refreshes', () => {
		const selectedCodeBlock = createMockCodeBlock({ creationIndex: 4 });
		const state = createMockState({
			codeBlockRendering: { selectedCodeBlock },
		});

		let tooltip = createEmptyTooltipState();
		tooltip = getTooltipState(content, state, selectedCodeBlock, tooltip, 100);
		expect(tooltip.animation.startedAt).toBe(100);

		tooltip = getTooltipState(content, state, selectedCodeBlock, tooltip, 200);
		expect(tooltip.animation.startedAt).toBe(100);

		selectedCodeBlock.cursor.row = 1;
		tooltip = getTooltipState(content, state, selectedCodeBlock, tooltip, 300);
		expect(tooltip.animation.startedAt).toBe(300);
	});

	it('restarts animation when content appears for the current target', () => {
		const selectedCodeBlock = createMockCodeBlock({ creationIndex: 4 });
		const state = createMockState({
			codeBlockRendering: { selectedCodeBlock },
		});

		let tooltip = createEmptyTooltipState();
		tooltip = getTooltipState(content, state, selectedCodeBlock, tooltip, 100);
		tooltip = createEmptyTooltipState();
		tooltip = getTooltipState(content, state, selectedCodeBlock, tooltip, 200);

		expect(tooltip.animation.startedAt).toBe(200);
	});
});
