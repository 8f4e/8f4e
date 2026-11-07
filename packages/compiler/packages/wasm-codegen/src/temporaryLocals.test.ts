import {
	createFunction,
	createLocalDeclaration,
	f32const,
	f32store,
	f64const,
	f64store,
	i32const,
	i32load,
	i32store,
	localGet,
	localSet,
	unsignedLEB128,
	WASM_DROP,
	WASM_I32_ADD,
	WASM_TYPE_F32,
	WASM_TYPE_F64,
	WASM_TYPE_I32,
} from '@8f4e/compiler-wasm-utils';
import { ArgumentType, BlockType, type CodegenContext } from '@8f4e/language-spec';
import { pushBlock } from '@8f4e/semantic-utils';
import { classifyIdentifier } from '@8f4e/tokenizer';
import { describe, expect, it } from 'vitest';
import createContext, { compileInstructionForTest, createStackFacts } from '../tests/testUtils';
import abs from './instructionCompilers/abs';
import createMinMax from './instructionCompilers/createMinMax';
import ensureNonZero from './instructionCompilers/ensureNonZero';
import loop from './instructionCompilers/loop';
import loopEnd from './instructionCompilers/loopEnd';
import mapEnd from './instructionCompilers/mapEnd';
import { guardedAddressOperation, guardedStore } from './instructionCompilers/utils/memoryAccessGuard';
import { allocateLocal, getCodegenLocals } from './localStorage';

// Execute exactly the storage tracked by codegen, so missing declarations or wrong types fail Wasm validation.
function execute(context: CodegenContext): number {
	const section = (id: number, bytes: number[]) => [id, ...unsignedLEB128(bytes.length), ...bytes];
	const body = createFunction(
		getCodegenLocals(context).map(local =>
			createLocalDeclaration(local.isInteger ? WASM_TYPE_I32 : local.isFloat64 ? WASM_TYPE_F64 : WASM_TYPE_F32, 1)
		),
		context.byteCode
	);
	const binary = new Uint8Array([
		0,
		97,
		115,
		109,
		1,
		0,
		0,
		0,
		...section(1, [1, 96, 0, 1, WASM_TYPE_I32]),
		...section(3, [1, 0]),
		...section(5, [1, 0, 1]),
		...section(7, [1, 3, 114, 117, 110, 0, 0]),
		...section(10, [1, ...body]),
	]);
	const instance = new WebAssembly.Instance(new WebAssembly.Module(binary));
	return (instance.exports.run as () => number)();
}

const loopLine = {
	instruction: 'loop' as const,
	lineNumber: 7,
	arguments: [{ type: ArgumentType.LITERAL as const, value: 2, isInteger: true }],
};

describe('anonymous codegen temporary lifetimes', () => {
	it('keeps same-line nested loop counters distinct and declares every allocation', () => {
		const context = createContext();
		const total = allocateLocal(context, 'source-binding', { isInteger: true });
		compileInstructionForTest(loop, loopLine, context);
		compileInstructionForTest(loop, loopLine, context);
		context.byteCode.push(...localGet(total.index), ...i32const(1), WASM_I32_ADD, ...localSet(total.index));
		compileInstructionForTest(loopEnd, { instruction: 'loopEnd', lineNumber: 7, arguments: [] }, context);
		compileInstructionForTest(loopEnd, { instruction: 'loopEnd', lineNumber: 7, arguments: [] }, context);
		context.byteCode.push(...localGet(total.index));
		expect(getCodegenLocals(context).map(local => local.index)).toEqual([0, 1, 2]);
		expect(context.locals).toEqual({ 'source-binding': total });
		expect(execute(context)).toBe(4);
	});

	it('declares repeated-line arithmetic and guard slots with their individual numeric types', () => {
		const context = createContext();
		for (const [valueType, constant] of [
			['int', i32const],
			['float', f32const],
			['float64', f64const],
		] as const) {
			context.byteCode.push(...constant(0));
			compileInstructionForTest(
				ensureNonZero,
				{ instruction: 'ensureNonZero', lineNumber: 7, arguments: [] },
				context,
				createStackFacts({ consumedOperands: [{ kind: 'value', valueType, isNonZero: false }] })
			);
			context.byteCode.push(WASM_DROP, ...i32const(0), ...constant(3));
			context.byteCode.push(
				...guardedStore(context, {
					lineNumber: 7,
					accessByteWidth: valueType === 'float64' ? 8 : 4,
					value: { kind: 'value', valueType },
					storeByteCode: valueType === 'int' ? i32store() : valueType === 'float' ? f32store() : f64store(),
				})
			);
		}
		for (let i = 0; i < 2; i++) {
			context.byteCode.push(...i32const(-9));
			compileInstructionForTest(
				abs,
				{ instruction: 'abs', lineNumber: 7, arguments: [] },
				context,
				createStackFacts({ consumedOperands: [{ kind: 'value', valueType: 'int' }] })
			);
			if (i === 0) context.byteCode.push(WASM_DROP);
		}
		expect(context.locals).toEqual({});
		expect(getCodegenLocals(context)).toHaveLength(11);
		expect(execute(context)).toBe(9);
	});

	it('keeps repeated-line maps and integer min/max storage declared', () => {
		const context = createContext();
		for (const outputKind of ['float64', 'int32'] as const) {
			context.byteCode.push(...i32const(1));
			pushBlock(context, {
				blockType: BlockType.MAP,
				expectedResultTypes: [],
				mapState: {
					inputIsInteger: true,
					inputIsFloat64: false,
					defaultSet: false,
					rows: [
						{
							keyValue: 1,
							valueValue: 10,
							valueIsInteger: outputKind === 'int32',
							valueIsFloat64: outputKind === 'float64',
						},
					],
				},
			});
			compileInstructionForTest(
				mapEnd,
				{
					instruction: 'mapEnd',
					lineNumber: 7,
					arguments: [classifyIdentifier(outputKind === 'int32' ? 'int' : 'float64')],
				},
				context,
				createStackFacts({ map: { inputKind: 'int32', outputKind } })
			);
			context.byteCode.push(WASM_DROP);
		}
		for (const instruction of ['min', 'max'] as const) {
			context.byteCode.push(...i32const(3), ...i32const(8));
			compileInstructionForTest(
				createMinMax(instruction),
				{ instruction, lineNumber: 7, arguments: [] },
				context,
				createStackFacts({ numericOperandKind: 'int32' })
			);
			if (instruction === 'min') context.byteCode.push(WASM_DROP);
		}
		expect(getCodegenLocals(context)).toHaveLength(8);
		expect(execute(context)).toBe(8);
	});

	it('preserves an outer guard address across a same-line nested guard', () => {
		const context = createContext();
		context.byteCode.push(...i32const(16), ...i32const(42), ...i32store(), ...i32const(16));
		context.byteCode.push(
			...guardedAddressOperation(context, {
				lineNumber: 7,
				accessByteWidth: 4,
				resultType: WASM_TYPE_I32,
				buildTrueBranch: outerAddress => [
					...i32const(32),
					...guardedAddressOperation(context, {
						lineNumber: 7,
						accessByteWidth: 4,
						resultType: WASM_TYPE_I32,
						buildTrueBranch: innerAddress => localGet(innerAddress),
					}),
					WASM_DROP,
					...localGet(outerAddress),
					...i32load(),
				],
			})
		);
		expect(getCodegenLocals(context).map(local => local.index)).toEqual([0, 1]);
		expect(execute(context)).toBe(42);
	});
});
