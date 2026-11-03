import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { createLibConfig } from '@8f4e/config/vite';
import { sourceFiles } from '@8f4e/vite-plugin-sources';
import { defineConfig } from 'vite';

const stdlibRoot = dirname(createRequire(import.meta.url).resolve('@8f4e/stdlib/package.json'));
const exampleModulesRoot = dirname(createRequire(import.meta.url).resolve('@8f4e/examples/package.json'));

export default defineConfig({
	base: './',
	plugins: [
		sourceFiles({ name: 'stdlib', root: stdlibRoot, include: ['std/**/*.8f4e'] }),
		sourceFiles({ name: 'example-modules', root: join(exampleModulesRoot, 'src/modules'), include: ['**/*.8f4em'] }),
	],
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
