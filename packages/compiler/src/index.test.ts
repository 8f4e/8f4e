import { serializeDiagnostic } from '@8f4e/compiler-diagnostics';
import type { CompileOptions, ProjectBlock, ProjectObjectModel } from '@8f4e/language-spec';
import { createFunctionId, ErrorCode } from '@8f4e/language-spec';
import { SyntaxErrorCode } from '@8f4e/tokenizer';
import { describe, expect, it } from 'vitest';
import { compileProjectObjectModel } from './compileProjectObjectModel';

type SourceFixture = { code: string[]; projectBlockId?: number };
type ProjectFixture = {
	entries: Record<string, SourceFixture[]>;
	constants: SourceFixture[];
	functions: SourceFixture[];
};

const emptyProjectFixture = {
	constants: [],
	functions: [],
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
		includes: [],
		notes: [],
		unknown: [],
	};
	return compileProjectObjectModel(project, options);
}

describe('compile project object model', () => {
	it.each(['prototype', 'prototypeEnd', 'shape', 'paramShape', 'pushShape'])(
		'treats %s as an unknown instruction',
		instruction => {
			let thrownError: unknown;

			try {
				compile(
					{
						...emptyProjectFixture,
						entries: { main: [{ code: ['module main', instruction, 'moduleEnd'], projectBlockId: 42 }] },
					},
					{}
				);
			} catch (error) {
				thrownError = error;
			}

			expect(serializeDiagnostic(thrownError, 'compile')).toMatchObject({
				code: SyntaxErrorCode.UNRECOGNISED_INSTRUCTION,
				instruction,
				location: expect.objectContaining({ projectBlockId: 42, lineNumber: 1 }),
			});
		}
	);

	it('rejects function ids that collide with generated entry function ids during semantic metadata collection', () => {
		let thrownError: unknown;

		try {
			compile(
				{
					...emptyProjectFixture,
					entries: { main: [{ code: ['module main', 'moduleEnd'] }] },
					functions: [{ code: ['function main', 'functionEnd'] }],
				},
				{}
			);
		} catch (error) {
			thrownError = error;
		}

		expect(serializeDiagnostic(thrownError, 'compile')).toMatchObject({
			code: ErrorCode.DUPLICATE_IDENTIFIER,
			instruction: 'function',
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
			{}
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
			{}
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
			{}
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

	it('keeps the last declaration and source identity for a parameter signature', () => {
		const result = compile(
			{
				...emptyProjectFixture,
				entries: { main: [{ code: ['module main', 'moduleEnd'] }] },
				functions: [
					{ code: ['function convert', 'param int value', 'push value', 'functionEnd int'], projectBlockId: 20 },
					{
						code: ['function convert', 'param int input', 'push input', 'castToFloat', 'functionEnd float'],
						projectBlockId: 21,
					},
				],
			},
			{}
		);

		expect(Object.keys(result.compiledFunctions!)).toEqual([createFunctionId('convert', ['int'])]);
		expect(result.compiledFunctions![createFunctionId('convert', ['int'])]).toMatchObject({
			signature: { parameters: [{ name: 'input', type: 'int' }], returns: ['float'] },
			ast: { functionLine: { diagnosticSource: { projectBlockId: 21 } } },
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
				{}
			);
		} catch (error) {
			thrownError = error;
		}

		expect(serializeDiagnostic(thrownError, 'compile')).toMatchObject({
			code: ErrorCode.INVALID_FUNCTION_OVERLOAD_SET,
			instruction: 'function',
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
				{}
			);
		} catch (error) {
			thrownError = error;
		}

		expect(serializeDiagnostic(thrownError, 'compile')).toMatchObject({
			code: ErrorCode.INVALID_FUNCTION_OVERLOAD_SET,
			instruction: 'function',
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
			{ includeStackAnalysis: true }
		);

		const calls = result.compiledModules.main.stackAnalysis!.filter(line => line.instruction === 'call');
		expect(calls.map(line => line.resolvedCall?.targetFunctionId)).toEqual([
			createFunctionId('consume', ['int']),
			createFunctionId('consume', ['float']),
		]);
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
				{}
			);
		} catch (error) {
			thrownError = error;
		}

		expect(serializeDiagnostic(thrownError, 'compile')).toMatchObject({
			code: ErrorCode.DUPLICATE_EXPORT_NAME,
			instruction: '#export',
			location: expect.objectContaining({ projectBlockId: 21 }),
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
				{}
			);
		} catch (error) {
			thrownError = error;
		}

		expect(serializeDiagnostic(thrownError, 'compile')).toMatchObject({
			code: ErrorCode.OVERLOADED_FUNCTION_EXPORT_UNSUPPORTED,
			instruction: '#export',
			location: expect.objectContaining({ projectBlockId: 20 }),
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
				{}
			);
		} catch (error) {
			thrownError = error;
		}

		expect(serializeDiagnostic(thrownError, 'compile')).toMatchObject({
			code: ErrorCode.DUPLICATE_EXPORT_NAME,
			instruction: '#export',
		});
	});

	it('can call an exported function without an internal caller', async () => {
		const result = compile(
			{
				...emptyProjectFixture,
				entries: { main: [{ code: ['module main', 'moduleEnd'] }] },
				functions: [
					{ code: ['function externallyCallable', '#export externallyCallable', 'push 42', 'functionEnd int'] },
				],
			},
			{}
		);

		const memory = new WebAssembly.Memory({ initial: 1, maximum: 1, shared: true });
		const { instance } = await WebAssembly.instantiate(new Uint8Array(result.codeBuffer), { host: { memory } });
		const externallyCallable = instance.exports.externallyCallable as () => number;
		expect(externallyCallable()).toBe(42);
	});
});
