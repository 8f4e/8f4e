import { createNodePreset } from '@8f4e/config/vitest';
import { defineConfig, mergeConfig } from 'vitest/config';

export default mergeConfig(
	createNodePreset({ root: __dirname, typecheckTsconfig: './tsconfig.json' }),
	defineConfig({ test: { coverage: { include: ['src/**/*.ts'] } } })
);
