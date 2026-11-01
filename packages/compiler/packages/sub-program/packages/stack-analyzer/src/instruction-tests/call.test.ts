import type {
	CompilationContext,
	CompilerASTLine,
	FunctionMetadata,
	LiteralPushLine,
	PlannedMemoryDeclaration,
	PlannedMemoryModule,
} from '@8f4e/language-spec';
import { ArgumentType, createFunctionId, ErrorCode } from '@8f4e/language-spec';
import { describe, expect, it } from 'vitest';
import createStackAnalyzerTestContext from '../../tests/testUtils';
import { analyzeInstruction } from '../analyzeInstruction';

const { classifyIdentifier } = await import('@8f4e/tokenizer');

function registerFunction(context: CompilationContext, ...targetFunctions: FunctionMetadata[]): void {
	context.namespace.functions = {
		byId: Object.fromEntries(
			targetFunctions.map(targetFunction => [
				createFunctionId(targetFunction.name, targetFunction.signature.parameters),
				targetFunction,
			])
		),
		arityByName: Object.fromEntries(
			targetFunctions.map(targetFunction => [targetFunction.name, targetFunction.signature.parameters.length])
		),
	};
}

describe('call stack analysis', () => {
	it('tracks float64 parameter and return types on stack', () => {
		const context = createStackAnalyzerTestContext();
		const targetFunction = {
			id: createFunctionId('foo64', ['float64']),
			name: 'foo64',
			signature: { parameters: ['float64'], returns: ['float64'] },
		} satisfies FunctionMetadata;
		registerFunction(context, targetFunction);
		context.stack.push({ kind: 'value', valueType: 'float64', isNonZero: false });

		analyzeInstruction(
			{
				lineNumber: 1,
				instruction: 'call',
				arguments: [classifyIdentifier('foo64')],
			} as CompilerASTLine,
			context
		);

		expect(context.stack).toHaveLength(1);
		expect(context.stack[0]).toMatchObject({ kind: 'value', valueType: 'float64' });
	});

	it('resolves scalar overloads from stack operand types', () => {
		const context = createStackAnalyzerTestContext();
		const intOverload = {
			id: 'convert__int',
			name: 'convert',
			signature: { parameters: ['int'], returns: [] },
		} satisfies FunctionMetadata;
		const floatOverload = {
			id: 'convert__float',
			name: 'convert',
			signature: { parameters: ['float'], returns: [] },
		} satisfies FunctionMetadata;
		registerFunction(context, intOverload, floatOverload);
		context.stack.push({ kind: 'value', valueType: 'float', isNonZero: false });

		const facts = analyzeInstruction(
			{
				lineNumber: 1,
				instruction: 'call',
				arguments: [classifyIdentifier('convert')],
			},
			context
		);

		expect(facts.targetFunctionId).toBe(floatOverload.id);
		expect('used' in floatOverload).toBe(false);
		expect('used' in intOverload).toBe(false);

		expect(context.stack).toEqual([]);
	});

	it('resolves pointer overloads from pointee metadata', () => {
		const context = createStackAnalyzerTestContext();
		const intOverload = {
			id: 'wrap__int',
			name: 'wrap',
			signature: { parameters: ['int'], returns: [] },
		} satisfies FunctionMetadata;
		const pointerOverload = {
			id: 'wrap__float_p',
			name: 'wrap',
			signature: { parameters: ['float*'], returns: [] },
		} satisfies FunctionMetadata;
		registerFunction(context, intOverload, pointerOverload);
		context.stack.push({
			kind: 'address',
			valueType: 'int',
			address: {},
			pointsTo: { baseType: 'float', pointerDepth: 1 },
		});

		const facts = analyzeInstruction(
			{
				lineNumber: 1,
				instruction: 'call',
				arguments: [classifyIdentifier('wrap')],
			},
			context
		);

		expect(facts.targetFunctionId).toBe(pointerOverload.id);

		expect(context.stack).toEqual([]);
	});

	it('resolves pointer overloads from known memory address literals', () => {
		const previousTrigger: PlannedMemoryDeclaration = {
			id: 'previousTrigger',
			elementByteLength: 4,
			allocatedByteLength: 4,
			endByteAddress: 0,
			endAddressSafeByteLength: 4,
			numberOfElements: 1,
			elementWordSize: 4,
			allocationUnitAddress: 0,
			allocationUnitCount: 1,
			byteAddress: 0,
			isInteger: true,
			pointerDepth: 0,
			isUnsigned: false,
			type: 'int',
			lineNumber: 1,
		};
		const plannedModule: PlannedMemoryModule = {
			id: 'test',
			lineNumber: 0,
			byteAddress: 0,
			allocationUnitCount: 1,
			allocatedByteLength: 4,
			endByteAddress: 0,
			endAddressSafeByteLength: 4,
			memory: { previousTrigger },
			declarations: [previousTrigger],
			declarationSources: [],
		};
		const context = createStackAnalyzerTestContext({
			currentPlannedModule: plannedModule,
			memoryPlan: {
				modules: { test: plannedModule },
				moduleList: [plannedModule],
			},
		});
		const targetFunction = {
			id: 'risingEdge__int__int_p',
			name: 'risingEdge',
			signature: { parameters: ['int', 'int*'], returns: [] },
		} satisfies FunctionMetadata;
		registerFunction(context, targetFunction);

		analyzeInstruction(
			{
				lineNumber: 1,
				instruction: 'push',
				arguments: [{ type: ArgumentType.LITERAL, value: 1, isInteger: true }],
			},
			context
		);
		analyzeInstruction(
			{
				lineNumber: 2,
				instruction: 'push',
				arguments: [
					{
						type: ArgumentType.LITERAL,
						value: 0,
						isInteger: true,
						address: {
							safeRange: {
								source: 'memory-start',
								byteAddress: 0,
								safeByteLength: 4,
								memoryId: 'previousTrigger',
							},
						},
					},
				],
			} as LiteralPushLine,
			context
		);

		const facts = analyzeInstruction(
			{
				lineNumber: 3,
				instruction: 'call',
				arguments: [classifyIdentifier('risingEdge')],
			},
			context
		);

		expect(facts.targetFunctionId).toBe(targetFunction.id);

		expect(context.stack).toEqual([]);
	});

	it('throws on float32 argument passed to float64 parameter', () => {
		const context = createStackAnalyzerTestContext();
		const targetFunction = {
			id: createFunctionId('foo64', ['float64']),
			name: 'foo64',
			signature: { parameters: ['float64'], returns: [] },
		} satisfies FunctionMetadata;
		registerFunction(context, targetFunction);
		context.stack.push({ kind: 'value', valueType: 'float', isNonZero: false });

		expect(() => {
			analyzeInstruction(
				{
					lineNumber: 1,
					instruction: 'call',
					arguments: [classifyIdentifier('foo64')],
				} as CompilerASTLine,
				context
			);
		}).toThrowError();
	});

	it('throws when no overload matches the stack operands', () => {
		const context = createStackAnalyzerTestContext();
		const intOverload = {
			id: 'convert__int',
			name: 'convert',
			signature: { parameters: ['int'], returns: [] },
		} satisfies FunctionMetadata;
		const floatOverload = {
			id: 'convert__float',
			name: 'convert',
			signature: { parameters: ['float'], returns: [] },
		} satisfies FunctionMetadata;
		registerFunction(context, intOverload, floatOverload);
		context.stack.push({ kind: 'value', valueType: 'float64', isNonZero: false });

		try {
			analyzeInstruction(
				{
					lineNumber: 1,
					instruction: 'call',
					arguments: [classifyIdentifier('convert')],
				},
				context
			);
			throw new Error('Expected FUNCTION_OVERLOAD_NO_MATCH for convert(float64), but call succeeded');
		} catch (error) {
			const message = String((error as { message?: string })?.message ?? error);
			expect(message).toContain(`${ErrorCode.FUNCTION_OVERLOAD_NO_MATCH}`);
			expect(message).toContain('Inferred call: convert(float64)');
			expect(message).toContain('Available overloads:\n- convert(float)\n- convert(int)');
		}
	});

	it('throws no-match when raw integer operands do not match pointer overloads', () => {
		const context = createStackAnalyzerTestContext();
		const floatPointerOverload = {
			id: 'wrap__float_p',
			name: 'wrap',
			signature: { parameters: ['float*'], returns: [] },
		} satisfies FunctionMetadata;
		const intPointerOverload = {
			id: 'wrap__int_p',
			name: 'wrap',
			signature: { parameters: ['int*'], returns: [] },
		} satisfies FunctionMetadata;
		registerFunction(context, floatPointerOverload, intPointerOverload);
		context.stack.push({ kind: 'value', valueType: 'int', isNonZero: false });

		try {
			analyzeInstruction(
				{
					lineNumber: 1,
					instruction: 'call',
					arguments: [classifyIdentifier('wrap')],
				},
				context
			);
			throw new Error('Expected FUNCTION_OVERLOAD_NO_MATCH for wrap(int), but call succeeded');
		} catch (error) {
			const message = String((error as { message?: string })?.message ?? error);
			expect(message).toContain(`${ErrorCode.FUNCTION_OVERLOAD_NO_MATCH}`);
			expect(message).toContain('Inferred call: wrap(int)');
			expect(message).toContain('Available overloads:\n- wrap(float*)\n- wrap(int*)');
		}
	});

	it('tracks pointer return types on the stack', () => {
		const context = createStackAnalyzerTestContext();
		const targetFunction = {
			id: createFunctionId('addr', []),
			name: 'addr',
			signature: { parameters: [], returns: ['float*'] },
		} satisfies FunctionMetadata;
		registerFunction(context, targetFunction);

		analyzeInstruction(
			{
				lineNumber: 1,
				instruction: 'call',
				arguments: [classifyIdentifier('addr')],
			} as CompilerASTLine,
			context
		);

		expect(context.stack).toHaveLength(1);
		expect(context.stack[0]).toMatchObject({
			kind: 'address',
			valueType: 'int',
			pointsTo: { baseType: 'float' },
		});
	});
});
