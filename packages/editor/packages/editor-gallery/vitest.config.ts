import { getReporters, sharedTestConfig } from '@8f4e/config/vitest';
import { defineConfig, mergeConfig } from 'vitest/config';
import viteConfig from './vite.config';

export default mergeConfig(
	viteConfig,
	defineConfig({
		test: {
			...sharedTestConfig,
			reporters: getReporters(),
			include: ['src/**/*.test.ts', 'src/__tests__/**/*.test.ts'],
			environment: 'node',
			typecheck: {
				enabled: true,
				tsconfig: './tsconfig.test.json',
			},
		},
	})
);
