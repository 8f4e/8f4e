import { createLibConfig } from '@8f4e/config/vite';
import { defineConfig } from 'vite';

export default defineConfig(
	createLibConfig({
		entry: './src/index.ts',
		outDir: 'dist',
		formats: ['es'],
		fileName: () => 'index.js',
		emptyOutDir: false,
		external: ['@8f4e/language-spec'],
	})
);
