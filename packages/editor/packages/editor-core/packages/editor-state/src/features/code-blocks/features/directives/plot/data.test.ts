import { describe, expect, it } from 'vitest';
import { parseEditorDirectives } from '../utils';
import { createPlotDirectiveData } from './data';
import plotDirective from './plugin';

function parsePlotDirectiveData(code: string[]) {
	return parseEditorDirectives(code, [plotDirective]).map(directive =>
		createPlotDirectiveData(directive.args, directive.sourceLineIndex)
	);
}

describe('plot directive data', () => {
	it('should parse plot instruction with an explicit array length memory', () => {
		const code = ['; @plot myArray arrayLength'];
		const result = parsePlotDirectiveData(code);

		expect(result).toEqual([
			{
				startAddressMemoryId: 'myArray',
				lineNumber: 0,
				length: 'arrayLength',
			},
		]);
	});

	it('should reject plot instruction without an explicit array length', () => {
		const code = ['; @plot myArray'];
		const result = parsePlotDirectiveData(code);

		expect(result).toEqual([undefined]);
	});

	it('should parse plot instruction with a literal element count', () => {
		const code = ['; @plot myArray 128'];
		const result = parsePlotDirectiveData(code);

		expect(result).toEqual([
			{
				startAddressMemoryId: 'myArray',
				lineNumber: 0,
				length: 128,
			},
		]);
	});

	it('rejects an incomplete range override', () => {
		const code = ['; @plot myArray -1 1'];
		const result = parsePlotDirectiveData(code);

		expect(result).toEqual([undefined]);
	});

	it('should parse plot instruction with both length and range override', () => {
		const code = ['; @plot myArray arrayLength -10 10'];
		const result = parsePlotDirectiveData(code);

		expect(result).toEqual([
			{
				startAddressMemoryId: 'myArray',
				lineNumber: 0,
				length: 'arrayLength',
				minValueOverride: -10,
				maxValueOverride: 10,
			},
		]);
	});

	it('should handle multiple plot instructions', () => {
		const code = ['; @plot buffer1 len1', 'mov a b', '; @plot buffer2 len2'];
		const result = parsePlotDirectiveData(code);

		expect(result).toEqual([
			{
				startAddressMemoryId: 'buffer1',
				lineNumber: 0,
				length: 'len1',
			},
			{
				startAddressMemoryId: 'buffer2',
				lineNumber: 2,
				length: 'len2',
			},
		]);
	});

	it('should return empty array when no plot instructions found', () => {
		const result = parsePlotDirectiveData(['mov a b', 'add c d', 'sub e f']);

		expect(result).toEqual([]);
	});

	it('should handle empty code array', () => {
		expect(parsePlotDirectiveData([])).toEqual([]);
	});
});
