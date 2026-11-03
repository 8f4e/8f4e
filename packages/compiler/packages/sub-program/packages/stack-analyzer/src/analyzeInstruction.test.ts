import type { CompilerASTLine, MapBlockStackFrame, MemoryAddressRange } from '@8f4e/language-spec';
import { ALLOCATION_UNIT_BYTE_SIZE, ArgumentType, BlockType, ErrorCode } from '@8f4e/language-spec';
import { describe, expect, it } from 'vitest';
import createStackAnalyzerTestContext from '../tests/testUtils';
import { analyzeInstruction } from './analyzeInstruction';

describe('analyzeInstruction', () => {
	it('records stack before, consumed operands, produced items, and stack after', () => {
		const context = createStackAnalyzerTestContext();
		context.stack.push(
			{ kind: 'value', valueType: 'int', isNonZero: false },
			{ kind: 'value', valueType: 'int', isNonZero: true }
		);

		const line = {
			lineNumber: 1,
			instruction: 'add',
			arguments: [],
		} as CompilerASTLine;

		const facts = analyzeInstruction(line, context);

		expect(facts.stackAnalysis).toEqual({
			stackBefore: [
				{ kind: 'value', valueType: 'int', isNonZero: false },
				{ kind: 'value', valueType: 'int', isNonZero: true },
			],
			consumedOperands: [
				{ kind: 'value', valueType: 'int', isNonZero: false },
				{ kind: 'value', valueType: 'int', isNonZero: true },
			],
			producedStackItems: [{ kind: 'value', valueType: 'int', isNonZero: false }],
			stackAfter: [{ kind: 'value', valueType: 'int', isNonZero: false }],
		});
		expect(context.stack).toEqual([{ kind: 'value', valueType: 'int', isNonZero: false }]);
		expect(facts.numericOperandKind).toBe('int32');
	});

	it('owns stack errors before codegen runs', () => {
		const context = createStackAnalyzerTestContext();
		const line = {
			lineNumber: 1,
			instruction: 'add',
			arguments: [],
		} as CompilerASTLine;

		expect(() => analyzeInstruction(line, context)).toThrow(`${ErrorCode.INSUFFICIENT_OPERANDS}`);
	});

	it('records push-produced stack metadata', () => {
		const context = createStackAnalyzerTestContext();
		const line = {
			lineNumber: 1,
			instruction: 'push',
			arguments: [{ type: ArgumentType.LITERAL, value: 7, isInteger: true }],
		} as CompilerASTLine;

		const facts = analyzeInstruction(line, context);

		expect(facts.stackAnalysis.producedStackItems).toEqual([
			{ kind: 'value', valueType: 'int', isNonZero: true, knownValue: 7 },
		]);
		expect(context.stack).toEqual([{ kind: 'value', valueType: 'int', isNonZero: true, knownValue: 7 }]);
	});

	it('records float32 and float64 push values at their runtime precision', () => {
		const context = createStackAnalyzerTestContext();
		const float32Line = {
			lineNumber: 1,
			instruction: 'push',
			arguments: [{ type: ArgumentType.LITERAL, value: Math.PI, isInteger: false }],
		} as CompilerASTLine;
		const float64Line = {
			lineNumber: 2,
			instruction: 'push',
			arguments: [{ type: ArgumentType.LITERAL, value: Math.PI, isInteger: false, isFloat64: true }],
		} as CompilerASTLine;

		const float32Facts = analyzeInstruction(float32Line, context);
		const float64Facts = analyzeInstruction(float64Line, context);

		expect(float32Facts.stackAnalysis.producedStackItems).toEqual([
			{ kind: 'value', valueType: 'float', isNonZero: true, knownValue: Math.fround(Math.PI) },
		]);
		expect(float64Facts.stackAnalysis.producedStackItems).toEqual([
			{ kind: 'value', valueType: 'float64', isNonZero: true, knownValue: Math.PI },
		]);
	});

	it.each([
		['add', 3.2, 1.1, Math.fround(Math.fround(3.2) + Math.fround(1.1))],
		['sub', 3.2, 1.1, Math.fround(Math.fround(3.2) - Math.fround(1.1))],
		['mul', 3.2, 2, Math.fround(Math.fround(3.2) * Math.fround(2))],
		['div', 3.2, 2, Math.fround(Math.fround(3.2) / Math.fround(2))],
	] as const)('propagates known float32 values through %s', (instruction, left, right, expected) => {
		const context = createStackAnalyzerTestContext({
			stack: [
				{ kind: 'value', valueType: 'float', isNonZero: true, knownValue: Math.fround(left) },
				{ kind: 'value', valueType: 'float', isNonZero: true, knownValue: Math.fround(right) },
			],
		});
		const line = { lineNumber: 1, instruction, arguments: [] } as CompilerASTLine;

		const facts = analyzeInstruction(line, context);

		expect(facts.stackAnalysis.producedStackItems).toEqual([
			{ kind: 'value', valueType: 'float', isNonZero: expected !== 0, knownValue: expected },
		]);
	});

	it('propagates known float64 division and absolute values', () => {
		const divisionContext = createStackAnalyzerTestContext({
			stack: [
				{ kind: 'value', valueType: 'float64', isNonZero: true, knownValue: 3.2 },
				{ kind: 'value', valueType: 'float64', isNonZero: true, knownValue: 2 },
			],
		});
		const absContext = createStackAnalyzerTestContext({
			stack: [{ kind: 'value', valueType: 'float', isNonZero: true, knownValue: Math.fround(-3.2) }],
		});

		const divisionFacts = analyzeInstruction(
			{ lineNumber: 1, instruction: 'div', arguments: [] } as CompilerASTLine,
			divisionContext
		);
		const absFacts = analyzeInstruction(
			{ lineNumber: 1, instruction: 'abs', arguments: [] } as CompilerASTLine,
			absContext
		);

		expect(divisionFacts.stackAnalysis.producedStackItems).toEqual([
			{ kind: 'value', valueType: 'float64', isNonZero: true, knownValue: 1.6 },
		]);
		expect(absFacts.stackAnalysis.producedStackItems).toEqual([
			{ kind: 'value', valueType: 'float', isNonZero: true, knownValue: Math.fround(3.2) },
		]);
	});

	it('records map input and output kinds', () => {
		const mapBlock: MapBlockStackFrame = {
			blockType: BlockType.MAP,
			expectedResultTypes: [],
			mapState: {
				inputIsInteger: false,
				inputIsFloat64: true,
				rows: [],
				defaultSet: false,
			},
		};
		const context = createStackAnalyzerTestContext({
			stack: [{ kind: 'value', valueType: 'float64' }],
			blockStack: [
				{
					blockType: BlockType.MODULE,
					expectedResultTypes: [],
				},
				mapBlock,
			],
			activeMapBlock: mapBlock,
		});
		const line = {
			lineNumber: 1,
			instruction: 'mapEnd',
			arguments: [
				{
					type: ArgumentType.IDENTIFIER,
					value: 'float',
					referenceKind: 'plain',
					scope: 'local',
				},
			],
		} as CompilerASTLine;

		const facts = analyzeInstruction(line, context);

		expect(facts.map).toEqual({ inputKind: 'float64', outputKind: 'float32' });
	});

	it('records clamp address facts', () => {
		const range: MemoryAddressRange = {
			source: 'memory-start',
			byteAddress: 16,
			safeByteLength: 64,
			memoryId: 'buffer',
		};
		const context = createStackAnalyzerTestContext();
		context.stack.push({
			kind: 'address',
			valueType: 'int',
			address: { clampRange: range },
		});
		const line = {
			lineNumber: 1,
			instruction: 'clampAddress',
			arguments: [{ type: ArgumentType.LITERAL, value: ALLOCATION_UNIT_BYTE_SIZE * 2, isInteger: true }],
		} as CompilerASTLine;

		const facts = analyzeInstruction(line, context);

		expect(facts.clamp).toEqual({
			accessByteWidth: ALLOCATION_UNIT_BYTE_SIZE * 2,
			range,
		});
	});
});
