import { describe, expect, it } from 'vitest';
import wrapText from './wrapText';

describe('wrapText', () => {
	it('wraps text by whole words when possible', () => {
		expect(wrapText('one two three four', 7)).toEqual(['one two', 'three', 'four']);
	});

	it('splits words that are longer than the max width', () => {
		expect(wrapText('superlongword', 4)).toEqual(['supe', 'rlon', 'gwor', 'd']);
	});

	it('respects existing newlines as hard breaks', () => {
		expect(wrapText('line one\nline two here', 8)).toEqual(['line one', 'line two', 'here']);
	});

	it('returns the input as a single entry when maxWidth is non-positive', () => {
		expect(wrapText('no wrapping', 0)).toEqual(['no wrapping']);
	});
});
