import { describe, expect, it } from 'vitest';
import { instructionSpecs } from './instructionSpecs';
import {
	compilerBlockInstructionPairs,
	compilerSourceBlockInstructionPairs,
	functionPreBodyInstructionNames,
	hasBinaryMatchingOperands,
	importedFunctionDeclarationInstructionNames,
	isFunctionBodyInstructionName,
	isFunctionPreBodyInstructionName,
	isImportedFunctionDeclarationInstructionName,
	isSubProgramInstructionName,
	knownInstructionNameSet,
	stackBlockInstructionPairs,
} from './instructions';

const functionInstructionClassificationSamples = [
	'push',
	'local',
	'call',
	'param',
	'paramShape',
	'functionEnd',
	'const',
	'use',
	'#import',
	'#impure',
	'#loopCap',
	'#export',
] as const;

describe('instruction block classification', () => {
	it('snapshots derived block tables', () => {
		const binaryMatchingInstructionNames = Object.entries(instructionSpecs)
			.filter(([, spec]) => hasBinaryMatchingOperands(spec))
			.map(([instruction]) => instruction);

		expect({
			binaryMatchingInstructionNames,
			compilerBlockInstructionPairs,
			compilerSourceBlockInstructionPairs,
			stackBlockInstructionPairs,
		}).toMatchSnapshot();
	});
});

describe('function instruction classification', () => {
	it('snapshots function classification tables', () => {
		expect({
			functionPreBodyInstructionNames,
			importedFunctionDeclarationInstructionNames,
			samples: Object.fromEntries(
				functionInstructionClassificationSamples.map(instruction => [
					instruction,
					{
						isFunctionBody: isFunctionBodyInstructionName(instruction),
						isFunctionPreBody: isFunctionPreBodyInstructionName(instruction),
						isImportedFunctionDeclaration: isImportedFunctionDeclarationInstructionName(instruction),
					},
				])
			),
		}).toMatchSnapshot();
	});
});

describe('instruction name classification', () => {
	it('includes project instructions in the complete set but excludes them from subprograms', () => {
		expect(knownInstructionNameSet.has('group')).toBe(true);
		expect(knownInstructionNameSet.has('groupEnd')).toBe(true);
		expect(knownInstructionNameSet.has('expose')).toBe(true);
		expect(knownInstructionNameSet.has('init')).toBe(true);
		expect(knownInstructionNameSet.has('bind')).toBe(false);
		expect(knownInstructionNameSet.has('pass')).toBe(true);
		expect(isSubProgramInstructionName('group')).toBe(false);
		expect(isSubProgramInstructionName('expose')).toBe(false);
		expect(isSubProgramInstructionName('init')).toBe(false);
		expect(isSubProgramInstructionName('pass')).toBe(false);
		expect(isSubProgramInstructionName('push')).toBe(true);
	});
});
