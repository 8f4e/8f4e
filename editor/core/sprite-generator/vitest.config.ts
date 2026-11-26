import { createNodePreset } from '@8f4e/config/vitest';
import { defineConfig } from 'vitest/config';

export default defineConfig(
	createNodePreset({
		include: ['tests/**/*.{test,spec}.ts', 'src/**/*.{test,spec}.ts'],
		typecheckEnabled: true,
	})
);
