import { createNodePreset } from '@8f4e/config/vitest';
import { defineConfig } from 'vitest/config';

export default defineConfig(
	createNodePreset({
		root: __dirname,
		typecheckTsconfig: './tsconfig.test.json',
	})
);
