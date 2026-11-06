import { createLibConfig } from '@8f4e/config/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	base: './',
	...createLibConfig({
		entry: './src/index.ts',
		outDir: 'dist',
		formats: ['es'],
		fileName: () => 'index.js',
		emptyOutDir: false,
	}),
	worker: {
		rollupOptions: {
			output: {
				entryFileNames: 'assets/workers/[name]-[hash].js',
				chunkFileNames: 'assets/workers/chunks/[name]-[hash].js',
			},
		},
	},
});
