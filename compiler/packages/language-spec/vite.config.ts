import { createLibConfig } from '@8f4e/config/vite';
import { defineConfig } from 'vite';

export default defineConfig(
	createLibConfig({
		entry: './src/index.ts',
		outDir: 'dist',
		emptyOutDir: false,
		formats: ['es'],
		fileName: () => 'index.js',
		external: ['@8f4e/compiler-wasm-utils'],
	})
);
