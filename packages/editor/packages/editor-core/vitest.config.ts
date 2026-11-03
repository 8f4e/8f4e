import { createNodePreset } from '@8f4e/config/vitest';
import { defineConfig } from 'vitest/config';

export default defineConfig({
	...createNodePreset({
		root: __dirname,
		include: ['src/**/*.{test,spec}.{ts,tsx}'],
		additionalExclude: [
			'src/**/testUtils.ts',
			'src/**/testFixtures.ts',
			'src/**/testHelpers.ts',
			'src/**/__tests__/**/fixtures/**',
			'packages/**',
		],
		typecheckEnabled: true,
	}),
});
