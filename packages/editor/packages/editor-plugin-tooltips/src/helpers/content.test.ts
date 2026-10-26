import { describe, expect, it } from 'vitest';

import { TOOLTIP_WRAP_WIDTH } from './constants';
import { getSelectedLineTooltipContent, getSelectedLineTooltipText } from './content';

function toCharacters(text: string): number[] {
	return [...text].map(char => char.charCodeAt(0));
}

describe('selected line tooltip content', () => {
	it('wraps selected line documentation', () => {
		expect(getSelectedLineTooltipText('push 1', 24)).toEqual([
			'push ( -- T)',
			'Pushes a literal, memory',
			'value, local value,',
			'address, or constant',
			'onto the stack.',
		]);
	});

	it('adds module execution order when provided', () => {
		expect(getSelectedLineTooltipText('module synth', TOOLTIP_WRAP_WIDTH, undefined, 3)).toEqual([
			'Starts a module block.',
			'execution order: 3',
		]);
	});

	it('generates tooltip color transitions for instructions and stack values', () => {
		const fontTooltipText = {};
		const fontTooltipHighlight = {};
		const content = getSelectedLineTooltipContent(
			'add',
			TOOLTIP_WRAP_WIDTH,
			{
				lineNumber: 2,
				instruction: 'add',
				stackAnalysis: {
					stackBefore: [
						{ kind: 'value', valueType: 'int', knownValue: 1 },
						{ kind: 'value', valueType: 'int', knownValue: 2 },
					],
					consumedOperands: [
						{ kind: 'value', valueType: 'int', knownValue: 1 },
						{ kind: 'value', valueType: 'int', knownValue: 2 },
					],
					producedStackItems: [{ kind: 'value', valueType: 'int' }],
					stackAfter: [{ kind: 'value', valueType: 'int' }],
				},
			},
			{
				fontTooltipText,
				fontTooltipHighlight,
			} as never
		);

		expect(content.text).toEqual([
			'add (T T -- T)',
			'Adds two numbers of the same',
			'type and pushes the result.',
			'before [-int=1, -int=2]',
			'after: [+int]',
		]);
		expect(content.characters[0]).toEqual(toCharacters('add (T T -- T)'));
		expect(content.lineCount).toBe(5);
		expect(content.widthChars).toBe('Adds two numbers of the same'.length);
		expect(content.colors[0][0]).toBe(fontTooltipHighlight);
		expect(content.colors[0][3]).toBeUndefined();
		expect(content.colors[3][0]).toBe(fontTooltipText);
		expect(content.colors[3][7]).toBe(fontTooltipHighlight);
		expect(content.colors[3][12]).toBeUndefined();
		expect(content.colors[4][0]).toBe(fontTooltipText);
		expect(content.colors[4][7]).toBe(fontTooltipHighlight);
		expect(content.highlightTargets).toEqual([
			{ lineIndex: 3, column: 8, widthChars: 6, fillColor: 'tooltipConsumedHighlight' },
			{ lineIndex: 3, column: 16, widthChars: 6, fillColor: 'tooltipConsumedHighlight' },
			{ lineIndex: 4, column: 8, widthChars: 4, fillColor: 'tooltipAddedHighlight' },
		]);
	});
});
