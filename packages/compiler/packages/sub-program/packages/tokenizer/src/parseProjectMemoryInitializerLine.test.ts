import { describe, expect, it } from 'vitest';
import { parseProjectMemoryInitializerLine } from './parseProjectMemoryInitializerLine';
import { SyntaxErrorCode } from './syntax/syntaxError';

describe('parseProjectMemoryInitializerLine', () => {
	it('preserves structured references and accepts an inline comment', () => {
		expect(parseProjectMemoryInitializerLine('init &input &source:output ; connection', 4)).toMatchObject({
			lineNumber: 4,
			instruction: 'init',
			arguments: [
				{ value: '&input', referenceKind: 'memory-reference', targetMemoryId: 'input' },
				{
					value: '&source:output',
					referenceKind: 'intermodular-reference',
					targetModuleId: 'source',
					targetMemoryId: 'output',
				},
			],
		});
	});

	it.each([
		['0', 0],
		['11', 11],
		['-11', -11],
		['0.5', 0.5],
		['0x10', 16],
		['0b101', 5],
		['1.25f64', 1.25],
	] as const)('accepts the numeric initializer %s', (source, value) => {
		const line = parseProjectMemoryInitializerLine(`init &foo ${source}`, 2);
		expect(line.arguments[1]).toMatchObject({ type: 'literal', value });
	});

	it('preserves float64 literal metadata', () => {
		expect(parseProjectMemoryInitializerLine('init &foo 1.25f64', 2).arguments[1]).toMatchObject({
			value: 1.25,
			isFloat64: true,
			isInteger: false,
		});
	});

	it.each([
		'init',
		'init &input',
		'init &input &source:output extra',
		'init input &source:output',
		'init &group:input &source:output',
		'init &input output',
		'init &input &output',
		'init &input "text"',
		'init input& &source:output',
		'init &input source:output&',
		'init &input &outer/source:output',
		'init &input &source:output+4',
	])('rejects unsupported initializer syntax: %s', source => {
		expect(() => parseProjectMemoryInitializerLine(source, 2)).toThrow(
			expect.objectContaining({
				code: SyntaxErrorCode.INVALID_PROJECT_MEMORY_INITIALIZER,
				line: { lineNumber: 2, instruction: 'init' },
			})
		);
	});
});
