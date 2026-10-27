import { describe, expect, it } from 'vitest';

import {
	getInstructionNameFromSourceLine,
	getInstructionSpecFromSourceLine,
	getMemoryDeclarationIdFromSourceLine,
	getStackSignatureFromSourceLine,
} from './sourceLine';

describe('tooltip source line helpers', () => {
	it('reads the instruction name from source text', () => {
		expect(getInstructionNameFromSourceLine('  add')).toBe('add');
		expect(getInstructionNameFromSourceLine('push 1')).toBe('push');
	});

	it('generates stack signatures from instruction specs', () => {
		expect(getStackSignatureFromSourceLine('add')).toBe('add (T T -- T)');
		expect(getStackSignatureFromSourceLine('drop')).toBe('drop (T -- )');
		expect(getStackSignatureFromSourceLine('branchIfTrue 1')).toBe('branchIfTrue (int -- )');
		expect(getStackSignatureFromSourceLine('load')).toBe('load (ptr -- int)');
		expect(getStackSignatureFromSourceLine('store')).toBe('store (ptr T -- )');
		expect(getStackSignatureFromSourceLine('storeBytes 3')).toBe('storeBytes (int int int ptr -- )');
		expect(getStackSignatureFromSourceLine('int value')).toBe('int ( -- )');
	});

	it('resolves language spec documentation from a source line', () => {
		expect(getInstructionSpecFromSourceLine('add')?.docs?.shortDescription).toBe(
			'Adds two numbers of the same type and pushes the result.'
		);
		expect(getInstructionSpecFromSourceLine('int value')?.docs?.shortDescription).toBe(
			'Declares memory storage for values used by the module.'
		);
		expect(getInstructionSpecFromSourceLine('; add')?.docs).toBeUndefined();
		expect(getInstructionSpecFromSourceLine('@pos 1 2')?.docs).toBeUndefined();
	});

	it('extracts named memory declaration ids from selected source lines', () => {
		expect(getMemoryDeclarationIdFromSourceLine('int value 1')).toBe('value');
		expect(getMemoryDeclarationIdFromSourceLine('int[] buffer 4 48 50')).toBe('buffer');
		expect(getMemoryDeclarationIdFromSourceLine('int 1')).toBeUndefined();
		expect(getMemoryDeclarationIdFromSourceLine('add')).toBeUndefined();
	});
});
