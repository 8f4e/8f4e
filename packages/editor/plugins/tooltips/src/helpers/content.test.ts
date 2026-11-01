import { PALETTE_INDICES } from '@8f4e/editor-palette';
import type { CompiledStackAnalysisLine } from '@8f4e/language-spec';
import { describe, expect, it } from 'vitest';

import { getSelectedLineTooltipContent, getSelectedLineTooltipText } from './content';

function toCharacters(text: string): number[] {
	return [...text].map(char => char.charCodeAt(0));
}

describe('selected line tooltip content', () => {
	it('wraps selected line documentation', () => {
		expect(getSelectedLineTooltipText({ line: 'push 1', maxLength: 24 })).toEqual([
			'push ( -- T)',
			'Pushes a literal, memory',
			'value, local value,',
			'address, or constant',
			'onto the stack.',
		]);
	});

	it('adds module execution order when provided', () => {
		expect(getSelectedLineTooltipText({ line: 'module synth', moduleExecutionOrder: 3 })).toEqual([
			'Starts a module block.',
			'execution order: 3',
		]);
	});

	it('generates tooltip color transitions for instructions and stack values', () => {
		const fontInverseInk = PALETTE_INDICES.inverseInk;
		const fontInverseAccent = PALETTE_INDICES.inverseAccent;
		const content = getSelectedLineTooltipContent({
			line: 'add',
			stackAnalysisLine: {
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
		});

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
		expect(content.colors[0][0]).toBe(fontInverseAccent);
		expect(content.colors[0][3]).toBeUndefined();
		expect(content.colors[3][0]).toBe(fontInverseInk);
		expect(content.colors[3][7]).toBe(fontInverseAccent);
		expect(content.colors[3][12]).toBeUndefined();
		expect(content.colors[4][0]).toBe(fontInverseInk);
		expect(content.colors[4][7]).toBe(fontInverseAccent);
		expect(content.highlightTargets).toEqual([
			{ lineIndex: 3, column: 8, widthChars: 6, fillColor: 'negativeSoft' },
			{ lineIndex: 3, column: 16, widthChars: 6, fillColor: 'negativeSoft' },
			{ lineIndex: 4, column: 8, widthChars: 4, fillColor: 'positiveSoft' },
		]);
	});
});

const callAnalysis = {
	lineNumber: 1,
	instruction: 'call',
	resolvedCall: {
		targetFunctionId: 'mix__float__float',
		signature: {
			parameters: [
				{ name: 'a', type: 'float' },
				{ name: 'b', type: 'float' },
			],
			returns: ['float'],
		},
	},
	stackAnalysis: { stackBefore: [], stackAfter: [], consumedOperands: [], producedStackItems: [] },
} satisfies CompiledStackAnalysisLine;

describe('call signature tooltips', () => {
	it('uses the source callable name and the concrete overload parameter names', () => {
		const content = getSelectedLineTooltipContent({
			line: '  call blend 0.2 0.8 ; mix',
			maxLength: 80,
			stackAnalysisLine: callAnalysis,
		});
		expect(content.text[0]).toBe('call blend (a: float b: float -- float)');
		expect(content.colors[0][0]).toBe(PALETTE_INDICES.inverseAccent);
	});

	it('wraps and highlights every signature line and offsets stack highlights below it', () => {
		const content = getSelectedLineTooltipContent({
			line: 'call mix',
			maxLength: 24,
			stackAnalysisLine: {
				...callAnalysis,
				stackAnalysis: {
					stackBefore: [{ kind: 'value', valueType: 'float' }],
					stackAfter: [],
					consumedOperands: [{ kind: 'value', valueType: 'float' }],
					producedStackItems: [],
				},
			},
		});
		expect(content.text.slice(0, 2)).toEqual(['call mix (a: float', 'b: float -- float)']);
		expect(content.text.every(line => line.length <= 24)).toBe(true);
		expect(content.colors.slice(0, 2).map(line => line[0])).toEqual([
			PALETTE_INDICES.inverseAccent,
			PALETTE_INDICES.inverseAccent,
		]);
		const stackLineIndex = content.text.findIndex(line => line.startsWith('before '));
		expect(content.highlightTargets[0].lineIndex).toBe(stackLineIndex);
		expect(content.colors[2][0]).toBe(PALETTE_INDICES.inverseInk);
	});

	it('shows empty parameter lists, pointer types, and multiple return types', () => {
		expect(
			getSelectedLineTooltipText({
				line: 'call init',
				maxLength: 80,
				stackAnalysisLine: {
					...callAnalysis,
					resolvedCall: { targetFunctionId: 'init__void', signature: { parameters: [], returns: [] } },
				},
			})[0]
		).toBe('call init ( -- )');
		expect(
			getSelectedLineTooltipText({
				line: 'call read',
				maxLength: 80,
				stackAnalysisLine: {
					...callAnalysis,
					resolvedCall: {
						targetFunctionId: 'read__float_p',
						signature: { parameters: [{ name: 'buffer', type: 'float*' }], returns: ['int', 'float64'] },
					},
				},
			})[0]
		).toBe('call read (buffer: float* -- int float64)');
	});

	it('keeps the generic signature until resolved call metadata is available', () => {
		expect(getSelectedLineTooltipText({ line: 'call mix' })[0]).toBe('call (args... -- returns...)');
		expect(getSelectedLineTooltipText({ line: 'add', maxLength: 80, stackAnalysisLine: callAnalysis })[0]).toBe(
			'add (T T -- T)'
		);
	});
});
