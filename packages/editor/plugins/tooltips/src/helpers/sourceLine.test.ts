import { describe, expect, it } from 'vitest';

import { describeSourceLine } from './sourceLine';

describe('tooltip source line helpers', () => {
	it('reads the instruction name from source text', () => {
		expect(describeSourceLine('  add').sourceInstruction?.instruction).toBe('add');
		expect(describeSourceLine('push 1').sourceInstruction?.arguments).toEqual(['1']);
	});

	it('resolves language spec documentation from a source line', () => {
		expect(describeSourceLine('add').sourceInstruction?.spec.docs?.shortDescription).toBe(
			'Adds two numbers of the same type and pushes the result.'
		);
		expect(describeSourceLine('int value').sourceInstruction?.spec.docs?.shortDescription).toBe(
			'Declares memory storage for values used by the module.'
		);
		expect(describeSourceLine('; add').sourceInstruction).toBeUndefined();
		expect(describeSourceLine('@pos 1 2').sourceInstruction).toBeUndefined();
	});

	it('extracts named memory declaration ids from selected source lines', () => {
		expect(describeSourceLine('int value 1').declaration).toEqual({ kind: 'memory', id: 'value' });
		expect(describeSourceLine('int[] buffer 4 48 50').declaration).toEqual({ kind: 'memory', id: 'buffer' });
		expect(describeSourceLine('int 1').declaration).toBeUndefined();
		expect(describeSourceLine('add').declaration).toBeUndefined();
	});

	it.each(['int&', 'int8&', 'int8u&', 'int16&', 'int16u&', 'float&', 'float64&'])(
		'extracts %s identifiers without treating them as allocated memory',
		instruction => {
			const line = `  ${instruction} input &source:0 ; fixed target`;
			expect(describeSourceLine(line)).toMatchObject({
				sourceInstruction: { instruction, arguments: ['input', '&source:0'] },
				declaration: { kind: 'reference', id: 'input' },
			});
		}
	);

	it.each([undefined, '', '; float& input &source:output', 'int&', 'int& 1 &source:0', 'push input'])(
		'leaves unrecognized or incomplete declarations unbound: %s',
		line => expect(describeSourceLine(line).declaration).toBeUndefined()
	);
	it('retains instruction documentation and declaration identity in an incomplete current edit', () => {
		const source = describeSourceLine('float& input &');
		expect(source.sourceInstruction?.spec.docs?.shortDescription).toContain('fixed memory reference');
		expect(source.declaration).toEqual({ kind: 'reference', id: 'input' });
		expect(describeSourceLine('int* input').declaration).toEqual({ kind: 'memory', id: 'input' });
	});
});
