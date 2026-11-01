import { describe, expect, it } from 'vitest';
import { getUniqueName } from './getUniqueName';

describe('getUniqueName', () => {
	it.each([
		['voice', [], 'voice'],
		['voice', ['voice'], 'voice1'],
		['voice', ['voice', 'voice1', 'voice2'], 'voice3'],
		['voice09', ['voice09'], 'voice10'],
		['voice7', ['voice7', 'voice8'], 'voice9'],
	])('finds an available name for %s', (name, existing, expected) => {
		expect(getUniqueName(name, new Set(existing))).toBe(expected);
	});
});
