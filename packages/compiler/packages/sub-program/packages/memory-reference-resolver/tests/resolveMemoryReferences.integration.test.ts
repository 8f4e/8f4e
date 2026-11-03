import type { ConstantsAST, FunctionAST, ModuleAST, PrototypeAST } from '@8f4e/language-spec';
import { describe, expect, it } from 'vitest';
import { type ResolveMemoryReferencesInput, resolveMemoryReferences } from '../src';

type MemoryReferenceResolverIntegrationInput = ResolveMemoryReferencesInput<
	PrototypeAST,
	ModuleAST,
	ConstantsAST,
	FunctionAST
>;

describe('resolveMemoryReferences integration', () => {
	it('resolves sub-program-level memory references from pass-shaped fixtures', () => {
		const mainModuleLine = {
			lineNumber: 1,
			instruction: 'module',
			arguments: [{ type: 'identifier', value: 'main', referenceKind: 'plain', scope: 'local' }],
		} as const;
		const samplesDeclarationLine = {
			lineNumber: 2,
			instruction: 'float[]',
			arguments: [
				{ type: 'identifier', value: 'samples', referenceKind: 'plain', scope: 'local' },
				{ type: 'literal', value: 4, isInteger: true },
			],
		} as const;
		const samplesStartReference = {
			type: 'identifier',
			value: '&samples',
			referenceKind: 'memory-reference',
			scope: 'local',
			targetMemoryId: 'samples',
			isEndAddress: false,
		} as const;
		const pointerDeclarationLine = {
			lineNumber: 3,
			instruction: 'float*',
			arguments: [{ type: 'identifier', value: 'ptr', referenceKind: 'plain', scope: 'local' }, samplesStartReference],
		} as const;
		const localAddressExpressionLine = {
			lineNumber: 4,
			instruction: 'push',
			arguments: [
				{
					type: 'compile_time_expression',
					left: samplesStartReference,
					operator: '+',
					right: { type: 'literal', value: 4, isInteger: true },
				},
			],
		} as const;
		const pointeeCountLine = {
			lineNumber: 5,
			instruction: 'push',
			arguments: [
				{
					type: 'identifier',
					value: 'count(*ptr)',
					referenceKind: 'pointee-element-count',
					scope: 'local',
					targetMemoryId: 'ptr',
					isPointee: true,
				},
			],
		} as const;
		const audioAddressLine = {
			lineNumber: 6,
			instruction: 'push',
			arguments: [
				{
					type: 'identifier',
					value: '&audio:samples',
					referenceKind: 'intermodular-reference',
					scope: 'intermodule',
					targetModuleId: 'audio',
					targetMemoryId: 'samples',
					isEndAddress: false,
				},
			],
		} as const;
		const mainModuleEndLine = {
			lineNumber: 7,
			instruction: 'moduleEnd',
			arguments: [],
		} as const;
		const audioModuleLine = {
			lineNumber: 10,
			instruction: 'module',
			arguments: [{ type: 'identifier', value: 'audio', referenceKind: 'plain', scope: 'local' }],
		} as const;
		const audioSamplesDeclarationLine = {
			lineNumber: 12,
			instruction: 'int16u[]',
			arguments: [
				{ type: 'identifier', value: 'samples', referenceKind: 'plain', scope: 'local' },
				{ type: 'literal', value: 6, isInteger: true },
			],
		} as const;
		const audioModuleEndLine = {
			lineNumber: 13,
			instruction: 'moduleEnd',
			arguments: [],
		} as const;
		const constantsLine = {
			lineNumber: 1,
			instruction: 'constants',
			arguments: [{ type: 'identifier', value: 'layout', referenceKind: 'plain', scope: 'local' }],
		} as const;
		const audioCountConstantLine = {
			lineNumber: 2,
			instruction: 'const',
			arguments: [
				{ type: 'identifier', value: 'int', referenceKind: 'plain', scope: 'local' },
				{ type: 'identifier', value: 'AUDIO_SAMPLE_COUNT', referenceKind: 'plain', scope: 'local' },
				{
					type: 'identifier',
					value: 'count(audio:samples)',
					referenceKind: 'intermodular-element-count',
					scope: 'intermodule',
					targetModuleId: 'audio',
					targetMemoryId: 'samples',
				},
			],
		} as const;
		const constantsEndLine = {
			lineNumber: 3,
			instruction: 'constantsEnd',
			arguments: [],
		} as const;
		const functionLine = {
			lineNumber: 1,
			instruction: 'function',
			arguments: [{ type: 'identifier', value: 'readPointer', referenceKind: 'plain', scope: 'local' }],
		} as const;
		const pointerParamLine = {
			lineNumber: 2,
			instruction: 'param',
			arguments: [
				{ type: 'identifier', value: 'float*', referenceKind: 'plain', scope: 'local' },
				{ type: 'identifier', value: 'sourcePtr', referenceKind: 'plain', scope: 'local' },
			],
		} as const;
		const pointeeSizeLine = {
			lineNumber: 3,
			instruction: 'push',
			arguments: [
				{
					type: 'identifier',
					value: 'sizeof(*sourcePtr)',
					referenceKind: 'pointee-element-word-size',
					scope: 'local',
					targetMemoryId: 'sourcePtr',
					isPointee: true,
				},
			],
		} as const;
		const functionEndLine = {
			lineNumber: 4,
			instruction: 'functionEnd',
			arguments: [{ type: 'identifier', value: 'int', referenceKind: 'plain', scope: 'local' }],
		} as const;
		const samplesMemory = {
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
			isInteger: false,
			id: 'samples',
			pointerDepth: 0,
			type: 'float',
			isUnsigned: false,
		} as const;
		const ptrMemory = {
			numberOfElements: 1,
			elementWordSize: 4,
			byteAddress: 20,
			elementByteLength: 4,
			allocationUnitCount: 1,
			allocatedByteLength: 4,
			allocationUnitAddress: 5,
			endByteAddress: 20,
			endAddressSafeByteLength: 4,
			lineNumber: 3,
			isInteger: true,
			id: 'ptr',
			pointerDepth: 1,
			pointeeBaseType: 'float',
			type: 'float*',
			isUnsigned: false,
		} as const;
		const audioSamplesMemory = {
			numberOfElements: 6,
			elementWordSize: 2,
			byteAddress: 4,
			elementByteLength: 12,
			allocationUnitCount: 3,
			allocatedByteLength: 12,
			allocationUnitAddress: 1,
			endByteAddress: 12,
			endAddressSafeByteLength: 4,
			lineNumber: 12,
			isInteger: true,
			id: 'samples',
			pointerDepth: 0,
			type: 'int16u',
			isUnsigned: true,
		} as const;
		const ast = {
			prototypes: [],
			modules: [
				{
					type: 'module',
					id: 'main',
					moduleLine: mainModuleLine,
					lines: [
						mainModuleLine,
						samplesDeclarationLine,
						pointerDeclarationLine,
						localAddressExpressionLine,
						pointeeCountLine,
						audioAddressLine,
						mainModuleEndLine,
					],
				},
				{
					type: 'module',
					id: 'audio',
					moduleLine: audioModuleLine,
					lines: [audioModuleLine, audioSamplesDeclarationLine, audioModuleEndLine],
				},
			],
			constants: [
				{
					type: 'constants',
					id: 'layout',
					constantsLine,
					lines: [constantsLine, audioCountConstantLine, constantsEndLine],
				},
			],
			functions: [
				{
					type: 'function',
					name: 'readPointer',
					functionLine,
					functionEndLine,
					lines: [functionLine, pointerParamLine, pointeeSizeLine, functionEndLine],
				},
			],
		} as const;
		const memoryPlan = {
			modules: {
				main: {
					id: 'main',
					lineNumber: 1,
					byteAddress: 4,
					allocationUnitCount: 5,
					allocatedByteLength: 20,
					endByteAddress: 20,
					endAddressSafeByteLength: 4,
					memory: {
						samples: samplesMemory,
						ptr: ptrMemory,
					},
					declarations: [samplesMemory, ptrMemory],
					declarationSources: [
						{ line: samplesDeclarationLine, isInherited: false },
						{ line: pointerDeclarationLine, isInherited: false },
					],
				},
				audio: {
					id: 'audio',
					lineNumber: 10,
					byteAddress: 4,
					allocationUnitCount: 3,
					allocatedByteLength: 12,
					endByteAddress: 12,
					endAddressSafeByteLength: 4,
					memory: {
						samples: audioSamplesMemory,
					},
					declarations: [audioSamplesMemory],
					declarationSources: [{ line: audioSamplesDeclarationLine, isInherited: false }],
				},
			},
			moduleList: [
				{
					id: 'main',
					lineNumber: 1,
					byteAddress: 4,
					allocationUnitCount: 5,
					allocatedByteLength: 20,
					endByteAddress: 20,
					endAddressSafeByteLength: 4,
					memory: {
						samples: samplesMemory,
						ptr: ptrMemory,
					},
					declarations: [samplesMemory, ptrMemory],
					declarationSources: [
						{ line: samplesDeclarationLine, isInherited: false },
						{ line: pointerDeclarationLine, isInherited: false },
					],
				},
				{
					id: 'audio',
					lineNumber: 10,
					byteAddress: 4,
					allocationUnitCount: 3,
					allocatedByteLength: 12,
					endByteAddress: 12,
					endAddressSafeByteLength: 4,
					memory: {
						samples: audioSamplesMemory,
					},
					declarations: [audioSamplesMemory],
					declarationSources: [{ line: audioSamplesDeclarationLine, isInherited: false }],
				},
			],
		} as const;
		const constantReferences = {
			prototypes: [],
			modules: [
				{
					lineFacts: [undefined, undefined, undefined, undefined, undefined, undefined, undefined],
				},
				{
					lineFacts: [undefined, undefined, undefined, undefined],
				},
			],
			constants: [
				{
					lineFacts: [undefined, undefined, undefined],
				},
			],
			functions: [
				{
					lineFacts: [undefined, undefined, undefined, undefined],
				},
			],
		} as const;

		expect(
			resolveMemoryReferences({
				ast,
				memoryPlan,
				memoryAliases: new Map(),
				projectMemoryInitializerScopes: [],
				constantReferences,
			} satisfies MemoryReferenceResolverIntegrationInput)
		).toMatchSnapshot();
	});
});
