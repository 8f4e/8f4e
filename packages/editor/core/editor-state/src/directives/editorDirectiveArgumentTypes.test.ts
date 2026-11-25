import { describe, expect, it } from 'vitest';
import {
	isMemoryAddress,
	isMemoryId,
	isMemoryTarget,
	isPointerSource,
	parseElementCount,
	parseFiniteNumber,
	parseInteger,
} from './editorDirectiveArgumentTypes';

describe('editor directive argument types', () => {
	it('distinguishes plain memory targets from pointer sources', () => {
		expect(isMemoryId('gain')).toBe(true);
		expect(isMemoryId('group/module:gain')).toBe(true);
		expect(isMemoryId('&gain')).toBe(false);
		expect(isMemoryId('*gain')).toBe(false);
		expect(isMemoryId('gain[1]')).toBe(false);
		expect(isMemoryAddress('&gain')).toBe(true);
		expect(isMemoryAddress('&group/module:gain')).toBe(true);
		expect(isMemoryAddress('gain')).toBe(false);
		expect(isMemoryAddress('&&gain')).toBe(false);
		expect(isPointerSource('bufferPointer')).toBe(true);
		expect(isPointerSource('&buffer')).toBe(true);
		expect(isPointerSource('&buffer[1]')).toBe(false);
	});
	it('separates control targets from dereferenced pointer sources', () => {
		for (const value of ['address', '&address', 'player:address', '&sampler/player:address']) {
			expect(isMemoryTarget(value)).toBe(true);
			expect(isPointerSource(value)).toBe(true);
		}
		for (const value of ['*address', '*player:address', '*sampler/player:address']) {
			expect(isMemoryTarget(value)).toBe(false);
			expect(isPointerSource(value)).toBe(true);
		}
		for (const value of ['*', '**address', '*&address', '*address[1]', '*address extra']) {
			expect(isMemoryTarget(value)).toBe(false);
			expect(isPointerSource(value)).toBe(false);
		}
	});

	it('parses finite decimal numbers and exact integers', () => {
		expect(parseFiniteNumber('-0.5')).toBe(-0.5);
		expect(parseFiniteNumber('1e-3')).toBe(0.001);
		expect(parseFiniteNumber('NaN')).toBeUndefined();
		expect(parseInteger('60')).toBe(60);
		expect(parseInteger('60.5')).toBeUndefined();
	});

	it('accepts only positive literal, memory, and count element counts', () => {
		expect(parseElementCount('128')).toBe(128);
		expect(parseElementCount('length')).toBe('length');
		expect(parseElementCount('count(buffer)')).toBe('count(buffer)');
		expect(parseElementCount('0')).toBeUndefined();
		expect(parseElementCount('&length')).toBeUndefined();
		expect(parseElementCount('count(&buffer)')).toBeUndefined();
	});
});
