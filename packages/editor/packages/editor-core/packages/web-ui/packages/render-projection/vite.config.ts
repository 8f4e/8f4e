import { createLibConfig } from '@8f4e/config/vite';
import { defineConfig } from 'vite';

const baseConfig = createLibConfig({
	entry: './src/index.ts',
	outDir: 'dist',
	formats: ['es'],
	fileName: () => 'index.js',
	emptyOutDir: false,
	external: [
		'@8f4e/editor-palette',
		'@8f4e/editor-state-types',
		'@8f4e/language-spec',
		'@8f4e/sprite-generator',
		'@8f4e/state-manager',
		'@8f4e/tokenizer',
	],
});

export default defineConfig({
	...baseConfig,
});
