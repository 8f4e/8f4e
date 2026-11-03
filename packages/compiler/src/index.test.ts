import type { CompileOptions, ProjectBlock, ProjectObjectModel } from '@8f4e/language-spec';
import { createFunctionId, ErrorCode } from '@8f4e/language-spec';
import { SyntaxErrorCode } from '@8f4e/tokenizer';
import { describe, expect, it } from 'vitest';
import { serializeDiagnostic } from '.';
import { compileProjectObjectModel } from './compileProjectObjectModel';

type SourceFixture = { code: string[]; projectBlockId?: number };
type ProjectFixture = {
	entries: Record<string, SourceFixture[]>;
	constants: SourceFixture[];
	functions: SourceFixture[];
	prototypes: SourceFixture[];
};

const emptyProjectFixture = {
	constants: [],
	functions: [],
	prototypes: [],
};

function compile(fixture: ProjectFixture, options: CompileOptions) {
	let generatedId = -1;
	const toBlock = (source: SourceFixture): ProjectBlock => ({
		id: source.projectBlockId ?? generatedId--,
		code: source.code,
	});
	const project: ProjectObjectModel = {
		entries: Object.keys(fixture.entries),
		code: [],
		execution: [
			...Object.entries(fixture.entries).flatMap(([entry, modules]) =>
				modules.map(module => ({ ...toBlock(module), type: 'module' as const, entry }))
			),
		],
		functions: fixture.functions.map(toBlock),
		constants: fixture.constants.map(toBlock),
		prototypes: fixture.prototypes.map(toBlock),
		includes: [],
		notes: [],
		unknown: [],
	};
	return compileProjectObjectModel(project, options);
}

describe('compile prototype validation', () => {
	it('rejects prototype block markers inside module source', () => {
		let thrownError: unknown;

		try {
			compile(
				{
					...emptyProjectFixture,
					entries: {
						main: [
							{
								code: ['module main', 'prototype nested', 'int value 1', 'prototypeEnd', 'moduleEnd'],
							},
						],
					},
				},
				{ disableSharedMemory: true }
			);
		} catch (error) {
			thrownError = error;
		}

		expect(serializeDiagnostic(thrownError)).toMatchObject({
			code: SyntaxErrorCode.INSTRUCTION_NOT_ALLOWED_IN_BLOCK,
			line: expect.objectContaining({ instruction: 'prototype' }),
		});
	});

	it('reports a tokenizer diagnostic when a prototype is missing an id', () => {
		let thrownError: unknown;

		try {
			compile(
				{
					...emptyProjectFixture,
					entries: { main: [] },
					prototypes: [{ code: ['prototype', 'prototypeEnd'] }],
				},
				{ disableSharedMemory: true }
			);
		} catch (error) {
			thrownError = error;
		}

		expect(serializeDiagnostic(thrownError)).toMatchObject({
			code: SyntaxErrorCode.MISSING_ARGUMENT,
			message: 'Missing required argument for prototype.',
			line: expect.objectContaining({ instruction: 'prototype' }),
		});
	});

	it('reports a syntax diagnostic when shape is missing a prototype id', () => {
		let thrownError: unknown;

		try {
			compile(
				{
					...emptyProjectFixture,
					entries: {
						main: [
							{
								projectBlockId: 42,
								code: ['module main', 'shape', 'moduleEnd'],
							},
						],
					},
				},
				{ disableSharedMemory: true }
			);
		} catch (error) {
			thrownError = error;
		}

		expect(serializeDiagnostic(thrownError)).toMatchObject({
			code: SyntaxErrorCode.MISSING_ARGUMENT,
			message: 'Missing required argument for shape.',
			line: expect.objectContaining({ instruction: 'shape' }),
			context: expect.objectContaining({ projectBlockId: 42 }),
		});
	});

	it('expands shapes after prototype parsing reaches the tokenizer', () => {
		const result = compile(
			{
				...emptyProjectFixture,
				entries: {
					main: [{ code: ['module main', 'shape state', 'moduleEnd'] }],
				},
				prototypes: [{ code: ['prototype state', 'int value 7', 'prototypeEnd'] }],
			},
			{ disableSharedMemory: true }
		);

		expect(result.memoryDefaultsByModuleId.main!.value?.value).toBe(7);
	});

	it('marks shape-expanded declarations as inherited at the shape line', () => {
		const result = compile(
			{
				...emptyProjectFixture,
				entries: {
					main: [{ code: ['module filterA', 'shape filterState', 'float cutoff 1200', 'moduleEnd'] }],
				},
				prototypes: [
					{
						code: [
							'prototype filterState',
							'float* input',
							'float cutoff 800',
							'float resonance 0.5',
							'float output',
							'prototypeEnd',
						],
					},
				],
			},
			{ disableSharedMemory: true }
		);

		const memory = result.memoryPlan.modules.filterA!.memory;
		const memoryDefaults = result.memoryDefaultsByModuleId.filterA!;
		expect(memory.input).toMatchObject({ lineNumber: 1 });
		expect(memoryDefaults.input).toMatchObject({ isInherited: true });
		expect(memory.resonance).toMatchObject({ lineNumber: 1 });
		expect(memoryDefaults.resonance).toMatchObject({ isInherited: true });
		expect(memory.output).toMatchObject({ lineNumber: 1 });
		expect(memoryDefaults.output).toMatchObject({ isInherited: true });
		expect(memory.cutoff).toMatchObject({ lineNumber: 2 });
		expect(memoryDefaults.cutoff).toMatchObject({ isInherited: false });
	});

	it('rejects function ids that collide with generated entry function ids during semantic metadata collection', () => {
		let thrownError: unknown;

		try {
			compile(
				{
					...emptyProjectFixture,
					entries: { main: [{ code: ['module main', 'moduleEnd'] }] },
					functions: [{ code: ['function main', 'functionEnd'] }],
				},
				{ disableSharedMemory: true }
			);
		} catch (error) {
			thrownError = error;
		}

		expect(serializeDiagnostic(thrownError)).toMatchObject({
			code: ErrorCode.DUPLICATE_IDENTIFIER,
			line: expect.objectContaining({ instruction: 'function' }),
		});
	});

	it('exposes function source names separately from compiler ids', () => {
		const result = compile(
			{
				...emptyProjectFixture,
				entries: { main: [{ code: ['module main', 'moduleEnd'] }] },
				functions: [
					{ code: ['function double', 'param int value', 'push value', 'push value', 'add', 'functionEnd int'] },
				],
			},
			{ disableSharedMemory: true }
		);

		const functionId = createFunctionId('double', ['int']);
		expect(result.compiledFunctions![functionId]).toMatchObject({
			id: functionId,
			name: 'double',
			ast: {
				name: 'double',
			},
		});
	});

	it('allows function namespace imports before parameter declarations', () => {
		const result = compile(
			{
				...emptyProjectFixture,
				entries: { main: [{ code: ['module main', 'moduleEnd'] }] },
				constants: [{ code: ['constants math', 'const OFFSET 2', 'constantsEnd'] }],
				functions: [
					{
						code: [
							'function addOffset',
							'use math',
							'const EXTRA_OFFSET 3',
							'param int value',
							'push value',
							'push OFFSET',
							'add',
							'push EXTRA_OFFSET',
							'add',
							'functionEnd int',
						],
					},
				],
			},
			{ disableSharedMemory: true }
		);

		const functionId = createFunctionId('addOffset', ['int']);
		expect(result.compiledFunctions![functionId]).toMatchObject({
			signature: { parameters: [{ name: 'value', type: 'int' }], returns: ['int'] },
		});
	});

	it('collects same-name functions as overloads when parameter signatures differ', () => {
		const result = compile(
			{
				...emptyProjectFixture,
				entries: { main: [{ code: ['module main', 'moduleEnd'] }] },
				functions: [
					{ code: ['function convert', 'param int value', 'push value', 'functionEnd int'] },
					{ code: ['function convert', 'param float value', 'push value', 'functionEnd float'] },
				],
			},
			{ disableSharedMemory: true }
		);

		const intOverloadId = createFunctionId('convert', ['int']);
		const floatOverloadId = createFunctionId('convert', ['float']);
		expect(result.compiledFunctions![intOverloadId]).toMatchObject({
			id: intOverloadId,
			name: 'convert',
			signature: { parameters: [{ name: 'value', type: 'int' }], returns: ['int'] },
			ast: { name: 'convert' },
		});
		expect(result.compiledFunctions![floatOverloadId]).toMatchObject({
			id: floatOverloadId,
			name: 'convert',
			signature: { parameters: [{ name: 'value', type: 'float' }], returns: ['float'] },
			ast: { name: 'convert' },
		});
	});

	it('rejects same-name functions with duplicate parameter signatures', () => {
		let thrownError: unknown;

		try {
			compile(
				{
					...emptyProjectFixture,
					entries: { main: [{ code: ['module main', 'moduleEnd'] }] },
					functions: [
						{ code: ['function convert', 'param int value', 'push value', 'functionEnd int'] },
						{ code: ['function convert', 'param int input', 'push input', 'functionEnd int'] },
					],
				},
				{ disableSharedMemory: true }
			);
		} catch (error) {
			thrownError = error;
		}

		expect(serializeDiagnostic(thrownError)).toMatchObject({
			code: ErrorCode.DUPLICATE_FUNCTION_SIGNATURE,
			line: expect.objectContaining({ instruction: 'function' }),
		});
	});

	it('rejects overload sets with mixed parameter arity', () => {
		let thrownError: unknown;

		try {
			compile(
				{
					...emptyProjectFixture,
					entries: { main: [{ code: ['module main', 'moduleEnd'] }] },
					functions: [
						{ code: ['function convert', 'param int value', 'push value', 'functionEnd int'] },
						{
							code: [
								'function convert',
								'param int value',
								'param int scale',
								'push value',
								'push scale',
								'add',
								'functionEnd int',
							],
						},
					],
				},
				{ disableSharedMemory: true }
			);
		} catch (error) {
			thrownError = error;
		}

		expect(serializeDiagnostic(thrownError)).toMatchObject({
			code: ErrorCode.INVALID_FUNCTION_OVERLOAD_SET,
			line: expect.objectContaining({ instruction: 'function' }),
		});
	});

	it('rejects zero-parameter functions from forming overload sets', () => {
		let thrownError: unknown;

		try {
			compile(
				{
					...emptyProjectFixture,
					entries: { main: [{ code: ['module main', 'moduleEnd'] }] },
					functions: [
						{ code: ['function tick', 'functionEnd'] },
						{ code: ['function tick', 'param int value', 'push value', 'functionEnd int'] },
					],
				},
				{ disableSharedMemory: true }
			);
		} catch (error) {
			thrownError = error;
		}

		expect(serializeDiagnostic(thrownError)).toMatchObject({
			code: ErrorCode.INVALID_FUNCTION_OVERLOAD_SET,
			line: expect.objectContaining({ instruction: 'function' }),
		});
	});

	it('resolves overloaded calls by exact stack operand types', () => {
		const result = compile(
			{
				...emptyProjectFixture,
				entries: {
					main: [{ code: ['module main', 'push 1', 'call consume', 'push 1.5', 'call consume', 'moduleEnd'] }],
				},
				functions: [
					{ code: ['function consume', 'param int value', 'functionEnd'] },
					{ code: ['function consume', 'param float value', 'functionEnd'] },
				],
			},
			{ disableSharedMemory: true }
		);

		const intOverloadId = createFunctionId('consume', ['int']);
		const floatOverloadId = createFunctionId('consume', ['float']);
		expect(result.compiledFunctions![intOverloadId].wasmIndex).not.toBe(
			result.compiledFunctions![floatOverloadId].wasmIndex
		);
	});

	it('rejects duplicate function export names during semantic metadata collection', () => {
		let thrownError: unknown;

		try {
			compile(
				{
					...emptyProjectFixture,
					entries: { main: [{ code: ['module main', 'moduleEnd'], projectBlockId: 10 }] },
					functions: [
						{ code: ['function first', '#export shared', 'functionEnd'], projectBlockId: 20 },
						{ code: ['function second', '#export shared', 'functionEnd'], projectBlockId: 21 },
					],
				},
				{ disableSharedMemory: true }
			);
		} catch (error) {
			thrownError = error;
		}

		expect(serializeDiagnostic(thrownError)).toMatchObject({
			code: ErrorCode.DUPLICATE_EXPORT_NAME,
			line: expect.objectContaining({ instruction: '#export' }),
			context: expect.objectContaining({ projectBlockId: 21 }),
		});
	});

	it('rejects exported overloaded functions during semantic metadata collection', () => {
		let thrownError: unknown;

		try {
			compile(
				{
					...emptyProjectFixture,
					entries: { main: [{ code: ['module main', 'moduleEnd'], projectBlockId: 10 }] },
					functions: [
						{ code: ['function convert', '#export convertInt', 'param int value', 'functionEnd'], projectBlockId: 20 },
						{ code: ['function convert', 'param float value', 'functionEnd'], projectBlockId: 21 },
					],
				},
				{ disableSharedMemory: true }
			);
		} catch (error) {
			thrownError = error;
		}

		expect(serializeDiagnostic(thrownError)).toMatchObject({
			code: ErrorCode.OVERLOADED_FUNCTION_EXPORT_UNSUPPORTED,
			line: expect.objectContaining({ instruction: '#export' }),
			context: expect.objectContaining({ projectBlockId: 20 }),
		});
	});

	it('rejects function exports that collide with generated entry exports', () => {
		let thrownError: unknown;

		try {
			compile(
				{
					...emptyProjectFixture,
					entries: { main: [{ code: ['module main', 'moduleEnd'] }] },
					functions: [{ code: ['function entryAlias', '#export main', 'functionEnd'] }],
				},
				{ disableSharedMemory: true }
			);
		} catch (error) {
			thrownError = error;
		}

		expect(serializeDiagnostic(thrownError)).toMatchObject({
			code: ErrorCode.DUPLICATE_EXPORT_NAME,
			line: expect.objectContaining({ instruction: '#export' }),
		});
	});

	it('marks exported functions as used roots during metadata collection', () => {
		const result = compile(
			{
				...emptyProjectFixture,
				entries: { main: [{ code: ['module main', 'moduleEnd'] }] },
				functions: [{ code: ['function externallyCallable', '#export externallyCallable', 'functionEnd'] }],
			},
			{ disableSharedMemory: true }
		);

		expect(result.compiledFunctions![createFunctionId('externallyCallable', [])].used).toBe(true);
	});
});
