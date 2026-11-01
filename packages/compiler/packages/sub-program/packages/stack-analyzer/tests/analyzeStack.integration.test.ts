import type { SourceLocalBinding } from '@8f4e/language-spec';
import { describe, expect, it } from 'vitest';
import { type AnalyzeStackSubProgramInput, analyzeStack } from '../src';

type StackAnalyzerIntegrationInput = AnalyzeStackSubProgramInput;

describe('analyzeStack integration', () => {
	it('analyzes a sub-program-level module and function report from pass-shaped fixtures', () => {
		const moduleLine = {
			lineNumber: 1,
			instruction: 'module',
			arguments: [{ type: 'identifier', value: 'main', referenceKind: 'plain', scope: 'local' }],
		} as const;
		const bufferDeclarationLine = {
			lineNumber: 2,
			instruction: 'int[]',
			arguments: [
				{ type: 'identifier', value: 'buffer', referenceKind: 'plain', scope: 'local' },
				{ type: 'literal', value: 4, isInteger: true },
			],
		} as const;
		const moduleEndLine = {
			lineNumber: 9,
			instruction: 'moduleEnd',
			arguments: [],
		} as const;
		const functionLine = {
			lineNumber: 1,
			instruction: 'function',
			arguments: [{ type: 'identifier', value: 'increment', referenceKind: 'plain', scope: 'local' }],
		} as const;
		const exportLine = {
			lineNumber: 2,
			instruction: '#export',
			arguments: [{ type: 'identifier', value: 'inc', referenceKind: 'plain', scope: 'local' }],
			isBlockPrologue: true,
		} as const;
		const functionEndLine = {
			lineNumber: 10,
			instruction: 'functionEnd',
			arguments: [{ type: 'identifier', value: 'int', referenceKind: 'plain', scope: 'local' }],
		} as const;
		const bufferMemory = {
			numberOfElements: 4,
			elementWordSize: 4,
			byteAddress: 4,
			elementByteLength: 16,
			allocationUnitCount: 4,
			allocatedByteLength: 16,
			allocationUnitAddress: 1,
			endByteAddress: 16,
			endAddressSafeByteLength: 4,
			lineNumber: 2,
			isInteger: true,
			id: 'buffer',
			pointerDepth: 0,
			type: 'int',
			isUnsigned: false,
		} as const;
		const bufferRange = {
			source: 'memory-start',
			byteAddress: 4,
			safeByteLength: 16,
			moduleId: 'main',
			memoryId: 'buffer',
		} as const;
		const ast = {
			modules: [
				{
					type: 'module',
					id: 'main',
					moduleLine,
					lines: [
						moduleLine,
						bufferDeclarationLine,
						{
							lineNumber: 3,
							instruction: 'push',
							arguments: [
								{
									type: 'identifier',
									value: '&buffer',
									referenceKind: 'memory-reference',
									scope: 'local',
									targetMemoryId: 'buffer',
									isEndAddress: false,
								},
							],
						},
						{
							lineNumber: 4,
							instruction: 'clampAddress',
							arguments: [{ type: 'literal', value: 4, isInteger: true }],
						},
						{ lineNumber: 5, instruction: 'drop', arguments: [] },
						{
							lineNumber: 6,
							instruction: 'push',
							arguments: [{ type: 'literal', value: 5, isInteger: true }],
						},
						{
							lineNumber: 7,
							instruction: 'call',
							arguments: [{ type: 'identifier', value: 'increment', referenceKind: 'plain', scope: 'local' }],
						},
						{ lineNumber: 8, instruction: 'drop', arguments: [] },
						moduleEndLine,
					],
				},
			],
			functions: [
				{
					type: 'function',
					name: 'increment',
					functionLine,
					functionEndLine,
					exportLine,
					lines: [
						functionLine,
						exportLine,
						{
							lineNumber: 3,
							instruction: 'param',
							arguments: [
								{ type: 'identifier', value: 'int', referenceKind: 'plain', scope: 'local' },
								{ type: 'identifier', value: 'value', referenceKind: 'plain', scope: 'local' },
							],
						},
						{
							lineNumber: 4,
							instruction: 'local',
							arguments: [
								{ type: 'identifier', value: 'int', referenceKind: 'plain', scope: 'local' },
								{ type: 'identifier', value: 'temp', referenceKind: 'plain', scope: 'local' },
							],
						},
						{
							lineNumber: 5,
							instruction: 'push',
							arguments: [{ type: 'identifier', value: 'value', referenceKind: 'plain', scope: 'local' }],
						},
						{
							lineNumber: 6,
							instruction: 'push',
							arguments: [{ type: 'literal', value: 1, isInteger: true }],
						},
						{ lineNumber: 7, instruction: 'add', arguments: [] },
						{
							lineNumber: 8,
							instruction: 'localSet',
							arguments: [{ type: 'identifier', value: 'temp', referenceKind: 'plain', scope: 'local' }],
						},
						{
							lineNumber: 9,
							instruction: 'push',
							arguments: [{ type: 'identifier', value: 'temp', referenceKind: 'plain', scope: 'local' }],
						},
						functionEndLine,
					],
				},
			],
		} as const;
		const memoryPlan = {
			modules: {
				main: {
					id: 'main',
					lineNumber: 1,
					byteAddress: 4,
					allocationUnitCount: 4,
					allocatedByteLength: 16,
					endByteAddress: 16,
					endAddressSafeByteLength: 4,
					memory: {
						buffer: bufferMemory,
					},
					declarations: [bufferMemory],
					declarationSources: [
						{
							line: bufferDeclarationLine,
							isInherited: false,
						},
					],
				},
			},
			moduleList: [
				{
					id: 'main',
					lineNumber: 1,
					byteAddress: 4,
					allocationUnitCount: 4,
					allocatedByteLength: 16,
					endByteAddress: 16,
					endAddressSafeByteLength: 4,
					memory: {
						buffer: bufferMemory,
					},
					declarations: [bufferMemory],
					declarationSources: [
						{
							line: bufferDeclarationLine,
							isInherited: false,
						},
					],
				},
			],
		} as const;
		const pointerMetadataByModuleId = {
			main: {},
		} as const;
		const functions = {
			byId: {
				increment__int: {
					id: 'increment__int',
					name: 'increment',
					signature: {
						parameters: ['int'],
						returns: ['int'],
					},
				},
			},
			arityByName: {
				increment: 1,
			},
		} as const;
		const functionTypeRegistry = {
			types: [],
			signatures: [],
			baseTypeIndex: 3,
		} as const;
		const valueBinding: SourceLocalBinding = { id: 0, name: 'value', type: 'int', parameterIndex: 0 };
		const tempBinding: SourceLocalBinding = { id: 1, name: 'temp', type: 'int' };
		const semanticReferences = {
			modules: {
				main: {
					ast: ast.modules[0],
					bindings: [],
					skipExecutionInCycle: false,
					body: ast.modules[0].lines.slice(2, -1).map((line, index) => ({
						sourceLineIndex: index + 2,
						line:
							index === 0
								? {
										...line,
										arguments: [
											{
												type: 'literal',
												value: 4,
												isInteger: true,
												address: { safeRange: bufferRange },
											},
										],
									}
								: line,
					})),
				},
			},
			functions: {
				increment__int: {
					ast: ast.functions[0],
					metadata: { ...functions.byId.increment__int, exportName: 'inc' },
					bindings: [valueBinding, tempBinding],
					body: ast.functions[0].lines.slice(4, -1).map((line, index) => ({
						sourceLineIndex: index + 4,
						line:
							line.instruction === 'localSet'
								? { ...line, binding: tempBinding }
								: line.instruction === 'push' && line.arguments[0].type === 'identifier'
									? {
											...line,
											resolvedTarget: { kind: 'local' as const, binding: index === 0 ? valueBinding : tempBinding },
										}
									: line,
					})),
				},
			},
		};

		expect(
			analyzeStack({
				semanticReferences,
				memoryPlan,
				pointerMetadataByModuleId,
				functions,
				functionTypeRegistry,
			} satisfies StackAnalyzerIntegrationInput)
		).toMatchSnapshot();
	});
});
