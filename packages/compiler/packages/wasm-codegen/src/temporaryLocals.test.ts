import {
	createCodeSection,
	createExportSection,
	createFunction,
	createFunctionExport,
	createFunctionSection,
	createFunctionType,
	createImportSection,
	createLocalDeclaration,
	createMemoryImport,
	createTypeSection,
	createWasmVersion,
	i32const,
	i32load,
	localGet,
	WASM_DROP,
	WASM_HEADER,
	WASM_TYPE_F32,
	WASM_TYPE_F64,
	WASM_TYPE_I32,
} from '@8f4e/compiler-wasm-utils';
import type {
	ComposedFunctionAST,
	ComposedModuleAST,
	ExecutableInstructionLine,
	FunctionSignature,
	SourceLocalBinding,
	StackItem,
} from '@8f4e/language-spec';
import type { ResolvedOperation } from '@8f4e/semantic-reference-resolver';
import { compileToAST, parseLine } from '@8f4e/tokenizer';
import { describe, expect, it } from 'vitest';
import createInstructionCompilerTestContext, { createStackFacts } from '../tests/testUtils';
import { compileFunction } from './compileFunction';
import { compileModule } from './compileModule';
import { functionValueTypeToWasmType } from './functionValueType';
import { buildPointerDereferenceByteCode } from './instructionCompilers/push/shared';
import { guardedAddressOperation, guardedLoad } from './instructionCompilers/utils/memoryAccessGuard';

const sourceLine = 7;
const functionLayout = createInstructionCompilerTestContext().functionLayout;
functionLayout.functions.test = { wasmIndex: 0, typeIndex: 0 };
const typeRegistry = { types: [], signatures: [], baseTypeIndex: 0 };

function operation(source: string, facts = createStackFacts()) {
	return { line: parseLine(source, sourceLine) as ExecutableInstructionLine, facts };
}

function operand(valueType: StackItem['valueType']) {
	return createStackFacts({ consumedOperands: [{ kind: 'value', valueType, isNonZero: false }] });
}

function compileBodies(
	operations: ReturnType<typeof operation>[],
	signature: FunctionSignature,
	bindings: SourceLocalBinding[] = []
) {
	const body: ResolvedOperation[] = operations.map(({ line }) => ({ line, sourceLineIndex: sourceLine }));
	const operationFacts = operations.map(({ facts }) => facts);
	const sourceIdentity = { projectGroupPath: '', codeBlockId: 'test' };
	const functionAst = {
		...compileToAST(['function test', 'functionEnd']),
		sourceIdentity,
	} as ComposedFunctionAST;
	const moduleAst = {
		...compileToAST(['module test', 'moduleEnd']),
		sourceIdentity,
		projectBlockId: 1,
		executionEntryName: 'main',
	} as ComposedModuleAST;
	const compiledFunction = compileFunction(
		{ ast: functionAst, metadata: { id: 'test', name: 'test', signature }, bindings, body },
		typeRegistry,
		functionLayout,
		{ functionId: 'test', operationFacts, stackAnalysis: [], finalStack: [] },
		{ isImported: false, hasExplicitReturn: false, hasEarlyReturn: false, isRecursive: false }
	);
	// Modules have no results; discard the same body's return values after exercising its locals.
	const drops = signature.returns.map(() =>
		operation('drop', createStackFacts({ droppedStackItems: [{ kind: 'value', valueType: 'int', isNonZero: false }] }))
	);
	const compiledModule = compileModule(
		{
			ast: moduleAst,
			bindings: bindings.filter(binding => binding.parameterIndex === undefined),
			body: [...body, ...drops.map(({ line }) => ({ line, sourceLineIndex: sourceLine }))],
			referenceSlots: {},
			skipExecutionInCycle: false,
		},
		0,
		functionLayout,
		{ operationFacts: [...operationFacts, ...drops.map(({ facts }) => facts)], stackAnalysis: [], finalStack: [] }
	);
	return { compiledFunction, compiledModule, body };
}

function instantiate(
	body: number[],
	signature: FunctionSignature,
	memory = new WebAssembly.Memory({ initial: 1, maximum: 1, shared: true })
) {
	const bytes = new Uint8Array([
		...WASM_HEADER,
		...createWasmVersion(1),
		...createTypeSection([
			createFunctionType(
				signature.parameters.map(parameter => functionValueTypeToWasmType(parameter.type)),
				signature.returns.map(functionValueTypeToWasmType)
			),
		]),
		...createImportSection([createMemoryImport('host', 'memory')]),
		...createFunctionSection([0]),
		...createExportSection([createFunctionExport('run', 0)]),
		...createCodeSection([body]),
	]);
	const module = new WebAssembly.Module(bytes);
	expect(WebAssembly.validate(bytes)).toBe(true);
	return new WebAssembly.Instance(module, {
		host: { memory },
	}).exports.run as (...parameters: number[]) => unknown;
}

describe('anonymous codegen temporaries', () => {
	it.each([
		{
			name: 'mixed ensureNonZero types',
			operations: [
				operation('push 0'),
				operation('ensureNonZero 11', operand('int')),
				operation('push 0.0'),
				operation('ensureNonZero 2.5', operand('float')),
				operation('push 0.0f64'),
				operation('ensureNonZero 3.25', operand('float64')),
			],
			returns: ['int', 'float', 'float64'] as const,
			expected: [11, 2.5, 3.25],
		},
		{
			name: 'repeated integer arithmetic',
			operations: [
				operation('push -4'),
				operation('abs', operand('int')),
				operation('push -5'),
				operation('abs', operand('int')),
				operation('push 2'),
				operation('push -1'),
				operation('min', createStackFacts({ numericOperandKind: 'int32' })),
				operation('push 7'),
				operation('push 3'),
				operation('min', createStackFacts({ numericOperandKind: 'int32' })),
				operation('push 2'),
				operation('push 7'),
				operation('max', createStackFacts({ numericOperandKind: 'int32' })),
				operation('push 9'),
				operation('push 3'),
				operation('max', createStackFacts({ numericOperandKind: 'int32' })),
			],
			returns: ['int', 'int', 'int', 'int', 'int', 'int'] as const,
			expected: [4, 5, -1, 3, 7, 9],
		},
		{
			name: 'memory guards with mixed stored values',
			operations: [
				...(['int', 'float', 'float64'] as const).flatMap((valueType, index) => {
					const address = 16 + index * 8;
					const value = ['11', '2.5', '3.25f64'][index];
					const facts = createStackFacts({
						consumedOperands: [
							{ kind: 'value', valueType: 'int', isNonZero: false },
							{ kind: 'value', valueType, isNonZero: false },
						],
					});
					return [
						operation(`push ${address}`),
						operation(`push ${value}`),
						operation('store', facts),
						operation('push -1'),
						operation(`push ${value}`),
						operation('store', facts),
					];
				}),
				operation('push 16'),
				operation('load', operand('int')),
				operation('push 24'),
				operation('loadFloat', {
					...operand('int'),
					stackAnalysis: {
						...operand('int').stackAnalysis,
						producedStackItems: [{ kind: 'value', valueType: 'float', isNonZero: false }],
					},
				}),
				operation('push 32'),
				operation('loadFloat', {
					...operand('int'),
					stackAnalysis: {
						...operand('int').stackAnalysis,
						producedStackItems: [{ kind: 'value', valueType: 'float64', isNonZero: false }],
					},
				}),
			],
			returns: ['int', 'float', 'float64'] as const,
			expected: [11, 2.5, 3.25],
		},
		{
			name: 'maps with mixed input and output types',
			operations: [
				operation('push 1'),
				operation('mapBegin int'),
				operation('map 1 2.5'),
				operation('mapEnd float', createStackFacts({ map: { inputKind: 'int32', outputKind: 'float32' } })),
				operation('push 3.5f64'),
				operation('mapBegin float64'),
				operation('map 3.5f64 9'),
				operation('mapEnd int', createStackFacts({ map: { inputKind: 'float64', outputKind: 'int32' } })),
				operation('push 1.5'),
				operation('mapBegin float'),
				operation('map 1.5 4.25f64'),
				operation('mapEnd float64', createStackFacts({ map: { inputKind: 'float32', outputKind: 'float64' } })),
			],
			returns: ['float', 'int', 'float64'] as const,
			expected: [2.5, 9, 4.25],
		},
	])('declares and executes $name at repeated source locations', ({ operations, returns, expected }) => {
		const signature: FunctionSignature = { parameters: [], returns: [...returns] };
		const { compiledFunction, compiledModule, body } = compileBodies(operations, signature);
		expect(instantiate(compiledFunction.body, signature)()).toEqual(expected);
		instantiate(compiledModule.cycleFunction, { parameters: [], returns: [] })();
		expect(
			body.every(({ line, sourceLineIndex }) => line.lineNumber === sourceLine && sourceLineIndex === sourceLine)
		).toBe(true);
	});

	it('keeps nested loop counters distinct when their source locations coincide', () => {
		const total: SourceLocalBinding = { id: 0, name: 'total', type: 'int' };
		const pushTotal = operation('push total');
		pushTotal.line = {
			...pushTotal.line,
			resolvedTarget: { kind: 'local', binding: total },
		} as ExecutableInstructionLine;
		const setTotal = operation('localSet total');
		setTotal.line = { ...setTotal.line, binding: total } as ExecutableInstructionLine;
		const signature: FunctionSignature = { parameters: [], returns: ['int'] };
		const { compiledFunction, compiledModule } = compileBodies(
			[
				operation('loop 2'),
				operation('loop 3'),
				pushTotal,
				operation('loopIndex'),
				operation('push 1'),
				operation('add', createStackFacts({ numericOperandKind: 'int32' })),
				operation('add', createStackFacts({ numericOperandKind: 'int32' })),
				setTotal,
				operation('loopEnd'),
				operation('loopEnd'),
				pushTotal,
			],
			signature,
			[total]
		);
		expect(compiledFunction.locals).toHaveLength(3);
		expect(instantiate(compiledFunction.body, signature)()).toBe(12);
		instantiate(compiledModule.cycleFunction, { parameters: [], returns: [] })();
	});

	it('declares source locals in allocation order after parameters rather than binding-key order', () => {
		const bindings: SourceLocalBinding[] = [
			{ id: 10, name: 'parameter', type: 'float64', parameterIndex: 0 },
			{ id: 8, name: 'first', type: 'float' },
			{ id: 2, name: 'second', type: 'int' },
		];
		const operations = bindings.flatMap((binding, index) => {
			const push = operation(`push ${binding.name}`);
			push.line = { ...push.line, resolvedTarget: { kind: 'local', binding } } as ExecutableInstructionLine;
			const set = operation(`localSet ${binding.name}`);
			set.line = { ...set.line, binding } as ExecutableInstructionLine;
			return binding.parameterIndex === undefined ? [operation(`push ${index === 1 ? '2.5' : '7'}`), set, push] : [];
		});
		const signature: FunctionSignature = {
			parameters: [{ name: 'parameter', type: 'float64' }],
			returns: ['float', 'int'],
		};
		const { compiledFunction, compiledModule } = compileBodies(operations, signature, bindings);
		expect(compiledFunction.locals.map(local => local.isInteger)).toEqual([false, true]);
		expect(instantiate(compiledFunction.body, signature)(3.5)).toEqual([2.5, 7]);
		instantiate(compiledModule.cycleFunction, { parameters: [], returns: [] })();
	});

	it('keeps an outer guard address live across an inner guard', () => {
		const context = createInstructionCompilerTestContext();
		const guarded = guardedAddressOperation(context, {
			accessByteWidth: 4,
			resultType: WASM_TYPE_I32,
			buildTrueBranch: outerAddress => [
				...i32const(0),
				...guardedLoad(context, { accessByteWidth: 4, resultType: WASM_TYPE_I32, loadByteCode: i32load() }),
				WASM_DROP,
				...localGet(outerAddress),
			],
		});
		expect(context.allocatedLocals.map(local => local.index)).toEqual([0, 1]);
		expect(context.locals).toEqual({});
		const body = createFunction(
			context.allocatedLocals.map(local =>
				createLocalDeclaration(local.isInteger ? WASM_TYPE_I32 : local.isFloat64 ? WASM_TYPE_F64 : WASM_TYPE_F32, 1)
			),
			[...i32const(64), ...guarded]
		);
		expect(instantiate(body, { parameters: [], returns: ['int'] })()).toBe(64);
	});

	it('explicitly reuses one integer address slot per pointer chain across mixed result types', () => {
		const memory = new WebAssembly.Memory({ initial: 1, maximum: 1, shared: true });
		const data = new DataView(memory.buffer);
		data.setInt32(0, 16, true);
		data.setInt32(16, 32, true);
		data.setInt32(32, 57, true);
		data.setFloat64(48, 3.25, true);
		const context = createInstructionCompilerTestContext();
		const integer = buildPointerDereferenceByteCode(
			context,
			{ pointeeBaseType: 'int', pointerDepth: 3 },
			i32const(0),
			'pointer-value',
			3
		);
		const float = buildPointerDereferenceByteCode(
			context,
			{ pointeeBaseType: 'float64', pointerDepth: 1 },
			i32const(48),
			'pointer-value',
			1
		);
		const invalid = buildPointerDereferenceByteCode(
			context,
			{ pointeeBaseType: 'int', pointerDepth: 3 },
			i32const(-1),
			'pointer-value',
			3
		);
		expect(context.allocatedLocals).toEqual([
			{ index: 0, isInteger: true },
			{ index: 1, isInteger: true },
			{ index: 2, isInteger: true },
		]);
		const body = createFunction(
			context.allocatedLocals.map(() => createLocalDeclaration(WASM_TYPE_I32, 1)),
			[...integer.byteCode, ...float.byteCode, ...invalid.byteCode]
		);
		expect(instantiate(body, { parameters: [], returns: ['int', 'float64', 'int'] }, memory)()).toEqual([57, 3.25, 0]);
	});
});
