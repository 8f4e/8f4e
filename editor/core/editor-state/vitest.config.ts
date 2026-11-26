import { createNodePreset } from '@8f4e/config/vitest';
import { resolve } from 'path';
import { fileURLToPath, URL } from 'url';
import { defineConfig } from 'vitest/config';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

const preset = createNodePreset({
	include: ['src/**/*.{test,spec}.ts', 'tests/**/*.{test,spec}.ts'],
	typecheckEnabled: true,
	resolve: {
		alias: {
			'~': resolve(__dirname, './src'),
		},
	},
});

export default defineConfig({
	...preset,
});
