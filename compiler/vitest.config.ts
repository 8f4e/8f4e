import { createNodePreset } from '@8f4e/config/vitest';
import { defineConfig } from 'vitest/config';

export default defineConfig(
	createNodePreset({
		include: ['src/**/*.test.ts', 'tests/**/*.test.ts'],
		typecheckEnabled: true,
	})
);
