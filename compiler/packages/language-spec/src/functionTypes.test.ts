import { describe, expect, it } from 'vitest';
import {
	createFunctionId,
	createFunctionParameterSignatureKey,
	encodeFunctionValueType,
	type FunctionValueType,
	functionValueTypeToLocalMetadata,
	functionValueTypeToStackItem,
	stackItemMatchesFunctionValueType,
	stackItemToFunctionValueType,
} from './functionTypes';
import type { LocalValueMetadata, StackItem } from './semantic';

describe('function value type helpers', () => {
	it.each([
		['int', { isInteger: true }],
		['float', { isInteger: false }],
		['float64', { isInteger: false, isFloat64: true }],
		['int*', { isInteger: true, pointeeBaseType: 'int', pointerDepth: 1 }],
		['int8u*', { isInteger: true, pointeeBaseType: 'int8u', pointerDepth: 1 }],
		['float64**', { isInteger: true, pointeeBaseType: 'float64', pointerDepth: 2 }],
	] satisfies Array<[FunctionValueType, LocalValueMetadata]>)(
		'converts %s to source value metadata',
		(type, expected) => {
			expect(functionValueTypeToLocalMetadata(type)).toEqual(expected);
		}
	);

	it.each([
		['int', { kind: 'value', valueType: 'int' }],
		['float', { kind: 'value', valueType: 'float' }],
		['float64', { kind: 'value', valueType: 'float64' }],
		[
			'int*',
			{
				kind: 'address',
				valueType: 'int',
				address: {},
				pointsTo: { baseType: 'int', pointerDepth: 1 },
			},
		],
		[
			'int16u**',
			{
				kind: 'address',
				valueType: 'int',
				address: {},
				pointsTo: { baseType: 'int16u', pointerDepth: 2 },
			},
		],
		[
			'float**',
			{
				kind: 'address',
				valueType: 'int',
				address: {},
				pointsTo: { baseType: 'float', pointerDepth: 2 },
			},
		],
	] satisfies Array<[FunctionValueType, StackItem]>)('converts %s to a stack item', (type, expected) => {
		expect(functionValueTypeToStackItem(type)).toEqual(expected);
	});

	it('matches scalar and pointer stack items to function value types', () => {
		const integer = { kind: 'value', valueType: 'int' } as const;
		const untypedAddress = { kind: 'address', valueType: 'int', address: {} } as const;
		const intPointer = functionValueTypeToStackItem('int*');
		const int8uPointer = functionValueTypeToStackItem('int8u*');
		const floatPointer = functionValueTypeToStackItem('float*');
		const intDoublePointer = functionValueTypeToStackItem('int**');

		expect(stackItemMatchesFunctionValueType(integer, 'int')).toBe(true);
		expect(stackItemMatchesFunctionValueType(untypedAddress, 'int')).toBe(true);
		expect(stackItemMatchesFunctionValueType({ kind: 'value', valueType: 'float' }, 'float')).toBe(true);
		expect(stackItemMatchesFunctionValueType({ kind: 'value', valueType: 'float64' }, 'float64')).toBe(true);
		expect(stackItemMatchesFunctionValueType({ kind: 'value', valueType: 'float' }, 'int')).toBe(false);
		expect(stackItemMatchesFunctionValueType({ kind: 'value', valueType: 'float' }, 'int*')).toBe(false);
		expect(stackItemMatchesFunctionValueType(integer, 'int*')).toBe(false);
		expect(stackItemMatchesFunctionValueType(untypedAddress, 'int*')).toBe(false);
		expect(stackItemMatchesFunctionValueType(intPointer, 'int*')).toBe(true);
		expect(stackItemMatchesFunctionValueType(intPointer, 'int')).toBe(false);
		expect(stackItemMatchesFunctionValueType(int8uPointer, 'int8u*')).toBe(true);
		expect(stackItemMatchesFunctionValueType(int8uPointer, 'int8*')).toBe(false);
		expect(stackItemMatchesFunctionValueType(intPointer, 'float*')).toBe(false);
		expect(stackItemMatchesFunctionValueType(floatPointer, 'float**')).toBe(false);
		expect(stackItemMatchesFunctionValueType(intDoublePointer, 'int*')).toBe(false);
	});

	it('derives exact function value types from stack items', () => {
		expect(stackItemToFunctionValueType({ kind: 'value', valueType: 'int' })).toBe('int');
		expect(stackItemToFunctionValueType({ kind: 'address', valueType: 'int', address: {} })).toBe('int');
		expect(stackItemToFunctionValueType(functionValueTypeToStackItem('float64**'))).toBe('float64**');
	});
});

describe('function type id helpers', () => {
	it.each([
		['int', 'int'],
		['float', 'float'],
		['float64', 'float64'],
		['int*', 'int_p'],
		['int**', 'int_p_p'],
		['int8u*', 'int8u_p'],
		['int16u**', 'int16u_p_p'],
		['float*', 'float_p'],
		['float64**', 'float64_p_p'],
	] satisfies Array<[FunctionValueType, string]>)('encodes %s as %s', (type, encoded) => {
		expect(encodeFunctionValueType(type)).toBe(encoded);
	});

	it('uses void as the zero-parameter signature key', () => {
		expect(createFunctionParameterSignatureKey([])).toBe('void');
	});

	it('joins encoded parameter types in source order', () => {
		expect(createFunctionParameterSignatureKey(['float*', 'float*', 'int'])).toBe('float_p__float_p__int');
	});

	it('creates a source name plus parameter signature id', () => {
		expect(createFunctionId('tick', [])).toBe('tick__void');
		expect(createFunctionId('wrapPointer', ['float*', 'float*', 'int'])).toBe('wrapPointer__float_p__float_p__int');
	});
});
