import { describe, expect, it } from 'vitest';

import extractUseDependencies from './extractUseDependencies';

describe('extractUseDependencies', () => {
	it('extracts dependencies from use instructions', () => {
		expect(
			extractUseDependencies(`module test
use math
use sine
moduleEnd`)
		).toEqual(['math', 'sine']);
	});

	it('deduplicates repeated use instructions', () => {
		expect(
			extractUseDependencies(`module test
use math
use math
moduleEnd`)
		).toEqual(['math']);
	});

	it('ignores commented and malformed lines', () => {
		expect(
			extractUseDependencies(`module test
; use notARealDependency
use
use env ; built-in
moduleEnd`)
		).toEqual(['env']);
	});
});
