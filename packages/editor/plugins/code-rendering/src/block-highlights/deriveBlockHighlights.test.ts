import { createMockCodeBlock } from '@8f4e/editor-state-testing';
import { describe, expect, it } from 'vitest';
import deriveBlockHighlights from './deriveBlockHighlights';

const viewport = { vGrid: 10, hGrid: 20 };

describe('deriveBlockHighlights', () => {
	it('highlights only the body, leaving the line-number gutter and boundary instructions visible', () => {
		const block = createMockCodeBlock({
			code: ['if condition', 'add', 'store', 'ifEnd'],
			width: 200,
			lineNumberColumnWidth: 1,
		});
		expect(deriveBlockHighlights(block, viewport)).toEqual([
			{ x: 30, y: 20, width: 170, height: 40, color: 'surfaceRaised1' },
		]);
	});

	it.each([
		['if', 'ifEnd'],
		['if', 'push 1'],
		['push 1', 'ifEnd'],
	])('ignores empty, unclosed, or unmatched blocks in %j', (...code) => {
		expect(deriveBlockHighlights(createMockCodeBlock({ code }), viewport)).toEqual([]);
	});

	it('cycles background shades by depth and gives else the same shade as if', () => {
		const code = ['if', 'loop', 'block', 'if', 'push 1', 'ifEnd', 'blockEnd', 'loopEnd', 'else', 'push 2', 'ifEnd'];
		const highlights = deriveBlockHighlights(createMockCodeBlock({ code }), viewport);
		expect(highlights.map(({ color }) => color)).toEqual([
			'surfaceRaised1',
			'surfaceRaised2',
			'surfaceRaised3',
			'surfaceRaised1',
			'surfaceRaised1',
		]);
		expect(highlights.at(-1)).toMatchObject({ y: 180, height: 20 });
	});

	it('uses the current gutter width and reserved rows without writing highlight data into core state', () => {
		const block = createMockCodeBlock({
			code: ['if', 'push 1', 'ifEnd'],
			width: 200,
			lineNumberColumnWidth: 2,
			gaps: new Map([[0, { size: 3 }]]),
		});
		const before = structuredClone(block);
		expect(deriveBlockHighlights(block, viewport)).toEqual([
			{ x: 40, y: 80, width: 160, height: 20, color: 'surfaceRaised1' },
		]);
		expect(block).toEqual(before);
	});
});
