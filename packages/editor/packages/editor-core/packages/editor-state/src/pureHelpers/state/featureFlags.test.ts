import { describe, expect, it } from 'vitest';
import { defaultFeatureFlags, validateFeatureFlags } from './featureFlags';

describe('feature flags', () => {
	it('returns the canonical defaults when no overrides are provided', () => {
		expect(validateFeatureFlags()).toEqual(defaultFeatureFlags);
	});

	it('applies partial overrides without changing other defaults', () => {
		expect(
			validateFeatureFlags({
				contextMenu: false,
				moduleDragging: false,
			})
		).toEqual({
			...defaultFeatureFlags,
			contextMenu: false,
			moduleDragging: false,
		});
	});
});
