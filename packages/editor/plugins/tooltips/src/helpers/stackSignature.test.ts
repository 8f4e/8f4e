import { describe, expect, it } from 'vitest';
import { formatStackSignature, formatStackSignatureLines } from './stackSignature';

describe('signature wrapping', () => {
	it('moves the complete next parameter to a new line', () => {
		expect(
			formatStackSignatureLines('call mix', { inputs: ['left: float', 'right: float'], outputs: ['float'] }, 32)
		).toEqual(['call mix (left: float', 'right: float -- float)']);
	});

	it('keeps pointer types with their names and allows an exact-width line', () => {
		expect(formatStackSignatureLines('call read', { inputs: ['buffer: float*'], outputs: [] }, 20)).toEqual([
			'call read',
			'(buffer: float* -- )',
		]);
	});

	it('keeps an oversized parameter intact instead of splitting its name or type', () => {
		const effect = { inputs: ['extremelyLongBufferName: float64**'], outputs: [] };
		const lines = formatStackSignatureLines('call read', effect, 16);
		expect(lines).toEqual(['call read', '(extremelyLongBufferName: float64**', '-- )']);
		expect(lines.join(' ')).toBe(formatStackSignature('call read', effect));
	});

	it('wraps multiple return types and preserves empty signatures', () => {
		expect(
			formatStackSignatureLines('call split', { inputs: ['input: int'], outputs: ['int', 'float64'] }, 24)
		).toEqual(['call split (input: int', '-- int float64)']);
		expect(formatStackSignatureLines('call init', { inputs: [], outputs: [] }, 32)).toEqual(['call init ( -- )']);
	});
});
