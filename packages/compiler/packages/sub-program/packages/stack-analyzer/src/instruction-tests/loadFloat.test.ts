import type { StackItem } from '@8f4e/language-spec';
import { describe, expect, it } from 'vitest';
import createStackAnalyzerTestContext from '../../tests/testUtils';
import { analyzeInstruction } from '../analyzeInstruction';

describe('loadFloat stack analysis', () => {
	it.each([
		{ baseType: 'float64', pointerDepth: 1, expected: 'float64' },
		{ baseType: 'float', pointerDepth: 1, expected: 'float' },
		{ baseType: 'int', pointerDepth: 1, expected: 'float' },
		{ baseType: 'float64', pointerDepth: 2, expected: 'float' },
	] as const)(
		'loads $expected from $baseType at pointer depth $pointerDepth',
		({ baseType, pointerDepth, expected }) => {
			const operand: StackItem = {
				kind: 'address',
				valueType: 'int',
				address: {},
				pointsTo: { baseType, pointerDepth },
			};
			const context = createStackAnalyzerTestContext({ stack: [operand] });
			const facts = analyzeInstruction({ instruction: 'loadFloat', lineNumber: 1, arguments: [] }, context);
			expect(facts.stackAnalysis.consumedOperands).toEqual([operand]);
			expect(context.stack).toEqual([{ kind: 'value', valueType: expected, isNonZero: false }]);
			expect(facts.stackAnalysis.producedStackItems).toEqual(context.stack);
		}
	);

	it('keeps untyped addresses as float32 loads', () => {
		const context = createStackAnalyzerTestContext({ stack: [{ kind: 'value', valueType: 'int' }] });
		analyzeInstruction({ instruction: 'loadFloat', lineNumber: 1, arguments: [] }, context);
		expect(context.stack).toEqual([{ kind: 'value', valueType: 'float', isNonZero: false }]);
	});

	it.each([
		{ instruction: 'add', reverse: false },
		{ instruction: 'add', reverse: true },
		{ instruction: 'sub', reverse: false },
	] as const)(
		'preserves unbounded float64 pointers through $instruction with reverse=$reverse',
		({ instruction, reverse }) => {
			const pointer: StackItem = {
				kind: 'address',
				valueType: 'int',
				address: {},
				pointsTo: { baseType: 'float64', pointerDepth: 1 },
			};
			const offset: StackItem = { kind: 'value', valueType: 'int', knownValue: 8 };
			const context = createStackAnalyzerTestContext({ stack: reverse ? [offset, pointer] : [pointer, offset] });
			analyzeInstruction({ instruction, lineNumber: 1, arguments: [] }, context);
			expect(context.stack[0]).toMatchObject({ kind: 'address', address: {}, pointsTo: pointer.pointsTo });
			analyzeInstruction({ instruction: 'loadFloat', lineNumber: 2, arguments: [] }, context);
			expect(context.stack).toEqual([{ kind: 'value', valueType: 'float64', isNonZero: false }]);
		}
	);
});
