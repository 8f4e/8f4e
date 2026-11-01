import { createLibConfig } from '@8f4e/config/vite';
import { defineConfig } from 'vite';

export default defineConfig(
	createLibConfig({
		entry: './src/index.ts',
		outDir: 'dist',
		formats: ['es'],
		fileName: () => 'index.js',
		emptyOutDir: false,
		external: [
			'@8f4e/editor-palette',
			'@8f4e/web-ui-render-projection',
			'@8f4e/language-spec',
			'@8f4e/editor-state',
			'@8f4e/editor-state/memory',
			'@8f4e/sprite-generator',
			'@8f4e/web-ui',
		],
	})
);
