import { describe, expect, it } from 'vitest';
import { describeSourceLine } from './sourceLine';
import { formatStackSignature, formatStackSignatureLines, resolveStackSignature } from './stackSignature';

describe('signature resolution', () => {
	it('resolves source arguments before compilation', () => {
		for (const [sourceLine, expected] of [
			['add', 'add (T T -- T)'],
			['add 3', 'add (T -- T)'],
			['mul *gain', 'mul (T -- T)'],
			['shiftRight 6', 'shiftRight (int -- int)'],
			['add ; comment', 'add (T T -- T)'],
			['drop', 'drop (T -- )'],
			['branchIfTrue 1', 'branchIfTrue (int -- )'],
			['load', 'load (ptr -- int)'],
			['store', 'store (ptr T -- )'],
			['storeBytes 3', 'storeBytes (int int int ptr -- )'],
			['int value', 'int ( -- )'],
		]) {
			const signature = resolveStackSignature({ sourceInstruction: describeSourceLine(sourceLine).sourceInstruction });
			expect(formatStackSignature(signature!)).toBe(expected);
		}
	});
});

describe('signature wrapping', () => {
	it('moves the complete next parameter to a new line', () => {
		expect(
			formatStackSignatureLines({
				signature: {
					instruction: 'call mix',
					stackEffect: { inputs: ['left: float', 'right: float'], outputs: ['float'] },
				},
				maxLength: 32,
			})
		).toEqual(['call mix (left: float', 'right: float -- float)']);
	});

	it('keeps pointer types with their names and allows an exact-width line', () => {
		expect(
			formatStackSignatureLines({
				signature: { instruction: 'call read', stackEffect: { inputs: ['buffer: float*'], outputs: [] } },
				maxLength: 20,
			})
		).toEqual(['call read', '(buffer: float* -- )']);
	});

	it('keeps an oversized parameter intact instead of splitting its name or type', () => {
		const signature = {
			instruction: 'call read',
			stackEffect: { inputs: ['extremelyLongBufferName: float64**'], outputs: [] },
		};
		const lines = formatStackSignatureLines({ signature, maxLength: 16 });
		expect(lines).toEqual(['call read', '(extremelyLongBufferName: float64**', '-- )']);
		expect(lines.join(' ')).toBe(formatStackSignature(signature));
	});

	it('wraps multiple return types and preserves empty signatures', () => {
		expect(
			formatStackSignatureLines({
				signature: {
					instruction: 'call split',
					stackEffect: { inputs: ['input: int'], outputs: ['int', 'float64'] },
				},
				maxLength: 24,
			})
		).toEqual(['call split (input: int', '-- int float64)']);
		expect(
			formatStackSignatureLines({
				signature: { instruction: 'call init', stackEffect: { inputs: [], outputs: [] } },
				maxLength: 32,
			})
		).toEqual(['call init ( -- )']);
	});
});
