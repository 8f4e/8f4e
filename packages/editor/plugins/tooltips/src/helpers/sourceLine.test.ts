import { describe, expect, it } from 'vitest';

import {
	getInstructionNameFromSourceLine,
	getMemoryDeclarationIdFromSourceLine,
	getReferenceDeclarationIdFromSourceLine,
	getSourceInstruction,
} from './sourceLine';

describe('tooltip source line helpers', () => {
	it('reads the instruction name from source text', () => {
		expect(getInstructionNameFromSourceLine('  add')).toBe('add');
		expect(getInstructionNameFromSourceLine('push 1')).toBe('push');
	});

	it('resolves language spec documentation from a source line', () => {
		expect(getSourceInstruction('add')?.spec.docs?.shortDescription).toBe(
			'Adds two numbers of the same type and pushes the result.'
		);
		expect(getSourceInstruction('int value')?.spec.docs?.shortDescription).toBe(
			'Declares memory storage for values used by the module.'
		);
		expect(getSourceInstruction('; add')).toBeUndefined();
		expect(getSourceInstruction('@pos 1 2')).toBeUndefined();
	});

	it('extracts named memory declaration ids from selected source lines', () => {
		expect(getMemoryDeclarationIdFromSourceLine('int value 1')).toBe('value');
		expect(getMemoryDeclarationIdFromSourceLine('int[] buffer 4 48 50')).toBe('buffer');
		expect(getMemoryDeclarationIdFromSourceLine('int 1')).toBeUndefined();
		expect(getMemoryDeclarationIdFromSourceLine('add')).toBeUndefined();
	});

	it.each(['int&', 'int8&', 'int8u&', 'int16&', 'int16u&', 'float&', 'float64&'])(
		'extracts %s identifiers without treating them as allocated memory',
		instruction => {
			const line = `  ${instruction} input &source:0 ; fixed target`;
			expect(getReferenceDeclarationIdFromSourceLine(line)).toBe('input');
			expect(getMemoryDeclarationIdFromSourceLine(line)).toBeUndefined();
		}
	);

	it.each([undefined, '', '; float& input &source:output', 'int&', 'int& 1 &source:0', 'int* input', 'push input'])(
		'ignores non-reference declarations: %s',
		line => expect(getReferenceDeclarationIdFromSourceLine(line)).toBeUndefined()
	);
});
