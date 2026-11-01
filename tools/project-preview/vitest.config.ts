import { defineConfig } from 'vitest/config';

export default defineConfig({
	root: __dirname,
	test: {
		environment: 'node',
		exclude: ['**/node_modules/**', '**/dist/**'],
		hookTimeout: 10_000,
		include: ['**/*.{test,spec}.ts', '**/tests/**/*.{test,spec}.ts'],
		testTimeout: 30_000,
		typecheck: {
			enabled: true,
			tsconfig: './tsconfig.test.json',
		},
	},
});
