import { describe, expect, it } from 'vitest';

import { formatDidYouMeanSuffix, getDidYouMeanSuggestion } from './suggestions';

describe('global editor directive suggestions', () => {
	it('returns the closest matching candidate for a small typo', () => {
		expect(getDidYouMeanSuggestion('terminus8x16bld', ['terminus8x16bold', 'terminus8x16'])).toBe('terminus8x16bold');
	});

	it('matches case-insensitively', () => {
		expect(getDidYouMeanSuggestion('documentsettings', ['DocumentSettings', 'EditorSettings'])).toBe(
			'DocumentSettings'
		);
	});

	it('suggests a prefix match even for a one-character input', () => {
		expect(getDidYouMeanSuggestion('t', ['terminus8x16', 'terminus8x16bold', 'spleen5x8'])).toBe('terminus8x16');
	});

	it('suggests a candidate when the input appears anywhere in it', () => {
		expect(getDidYouMeanSuggestion('prefix', ['text.code', 'text.basePrefix', 'fill.background'])).toBe(
			'text.basePrefix'
		);
	});

	it('does not require segment separators for substring suggestions', () => {
		expect(getDidYouMeanSuggestion('prefix', ['textbasePrefix', 'fill.background'])).toBe('textbasePrefix');
	});

	it('does not depend on a specific separator for substring suggestions', () => {
		expect(getDidYouMeanSuggestion('prefix', ['text@basePrefix', 'fill.background'])).toBe('text@basePrefix');
	});

	it('prefers the shortest substring match', () => {
		expect(getDidYouMeanSuggestion('code', ['text.codeComment', 'text.code'])).toBe('text.code');
	});

	it('skips suggestions when no candidate is close enough', () => {
		expect(getDidYouMeanSuggestion('tiny', ['DocumentSettings', 'EditorSettings'])).toBeUndefined();
	});

	it('formats a did-you-mean suffix when a close match exists', () => {
		expect(formatDidYouMeanSuffix('of', ['off', 'on'])).toBe(" Did you mean 'off'?");
	});
});
