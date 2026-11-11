import type { ModuleAST, PrototypeAST } from '@8f4e/language-spec';
import { describe, expect, it } from 'vitest';
import { planSubProgramMemoryLayout, type SubProgramMemoryLayoutPlanInput } from '../src';

type MemoryPlannerIntegrationInput = SubProgramMemoryLayoutPlanInput<PrototypeAST, ModuleAST>;

describe('planSubProgramMemoryLayout integration', () => {
	it('plans sub-program-level memory layout from pass-shaped fixtures', () => {
		const statePrototypeLine = {
			diagnosticSource: { kind: 'document' },
			lineNumber: 1,
			instruction: 'prototype',
			arguments: [{ type: 'identifier', value: 'state', referenceKind: 'plain', scope: 'local' }],
		} as const;
		const phaseDeclarationLine = {
			diagnosticSource: { kind: 'document' },
			lineNumber: 2,
			instruction: 'float',
			arguments: [{ type: 'identifier', value: 'phase', referenceKind: 'plain', scope: 'local' }],
		} as const;
		const gainDeclarationLine = {
			diagnosticSource: { kind: 'document' },
			lineNumber: 3,
			instruction: 'float',
			arguments: [{ type: 'identifier', value: 'gain', referenceKind: 'plain', scope: 'local' }],
		} as const;
		const statePrototypeEndLine = {
			diagnosticSource: { kind: 'document' },
			lineNumber: 4,
			instruction: 'prototypeEnd',
			arguments: [],
		} as const;
		const mainModuleLine = {
			diagnosticSource: { kind: 'document' },
			lineNumber: 10,
			instruction: 'module',
			arguments: [{ type: 'identifier', value: 'main', referenceKind: 'plain', scope: 'local' }],
		} as const;
		const stateShapeLine = {
			diagnosticSource: { kind: 'document' },
			lineNumber: 11,
			instruction: 'shape',
			arguments: [{ type: 'identifier', value: 'state', referenceKind: 'plain', scope: 'local' }],
		} as const;
		const counterDeclarationLine = {
			diagnosticSource: { kind: 'document' },
			lineNumber: 12,
			instruction: 'int',
			arguments: [{ type: 'identifier', value: 'counter', referenceKind: 'plain', scope: 'local' }],
		} as const;
		const bytesDeclarationLine = {
			diagnosticSource: { kind: 'document' },
			lineNumber: 13,
			instruction: 'int8[]',
			arguments: [
				{ type: 'identifier', value: 'bytes', referenceKind: 'plain', scope: 'local' },
				{ type: 'literal', value: 5, isInteger: true },
			],
		} as const;
		const doublesDeclarationLine = {
			diagnosticSource: { kind: 'document' },
			lineNumber: 14,
			instruction: 'float64[]',
			arguments: [
				{ type: 'identifier', value: 'doubles', referenceKind: 'plain', scope: 'local' },
				{ type: 'literal', value: 2, isInteger: true },
			],
		} as const;
		const mainModuleEndLine = {
			diagnosticSource: { kind: 'document' },
			lineNumber: 15,
			instruction: 'moduleEnd',
			arguments: [],
		} as const;
		const audioModuleLine = {
			diagnosticSource: { kind: 'document' },
			lineNumber: 20,
			instruction: 'module',
			arguments: [{ type: 'identifier', value: 'audio', referenceKind: 'plain', scope: 'local' }],
		} as const;
		const samplesDeclarationLine = {
			diagnosticSource: { kind: 'document' },
			lineNumber: 22,
			instruction: 'float[]',
			arguments: [
				{ type: 'identifier', value: 'samples', referenceKind: 'plain', scope: 'local' },
				{ type: 'literal', value: 3, isInteger: true },
			],
		} as const;
		const peaksDeclarationLine = {
			diagnosticSource: { kind: 'document' },
			lineNumber: 23,
			instruction: 'int16u[]',
			arguments: [
				{ type: 'identifier', value: 'peaks', referenceKind: 'plain', scope: 'local' },
				{ type: 'literal', value: 6, isInteger: true },
			],
		} as const;
		const audioModuleEndLine = {
			diagnosticSource: { kind: 'document' },
			lineNumber: 24,
			instruction: 'moduleEnd',
			arguments: [],
		} as const;
		const prototypes = [
			{
				type: 'prototype',
				id: 'state',
				prototypeLine: statePrototypeLine,
				lines: [statePrototypeLine, phaseDeclarationLine, gainDeclarationLine, statePrototypeEndLine],
			},
		] as const;
		const modules = [
			{
				type: 'module',
				id: 'main',
				moduleLine: mainModuleLine,
				lines: [
					mainModuleLine,
					stateShapeLine,
					counterDeclarationLine,
					bytesDeclarationLine,
					doublesDeclarationLine,
					mainModuleEndLine,
				],
			},
			{
				type: 'module',
				id: 'audio',
				moduleLine: audioModuleLine,
				lines: [audioModuleLine, samplesDeclarationLine, peaksDeclarationLine, audioModuleEndLine],
			},
		] as const;
		const constantReferences = {
			prototypes: [
				{
					lineFacts: [undefined, undefined, undefined, undefined],
				},
			],
			modules: [
				{
					lineFacts: [undefined, undefined, undefined, undefined, undefined, undefined],
				},
				{
					lineFacts: [undefined, undefined, undefined, undefined, undefined],
				},
			],
		} as const;

		expect(
			planSubProgramMemoryLayout({
				prototypes,
				modules,
				constantReferences,
				startingByteAddress: 4,
			} satisfies MemoryPlannerIntegrationInput)
		).toMatchSnapshot();
	});
});
