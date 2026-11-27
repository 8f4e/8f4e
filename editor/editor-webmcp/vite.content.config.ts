import { sourceFiles } from '@8f4e/vite-plugin-sources';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [
		sourceFiles({
			name: 'reference-compiler',
			root: new URL(import.meta.resolve('@8f4e/compiler/docs')),
			include: ['**/*.md'],
		}),
		sourceFiles({
			name: 'reference-editor',
			root: new URL(import.meta.resolve('@8f4e/editor-core/docs')),
			include: ['**/*.md'],
		}),
		sourceFiles({
			name: 'reference-blocks',
			root: new URL(import.meta.resolve('@8f4e/examples/modules')),
			include: ['**/*.8f4em'],
		}),
		sourceFiles({ name: 'reference-projects', root: new URL(import.meta.resolve('@8f4e/examples/projects')) }),
	],
	build: {
		ssr: 'scripts/generate-content.ts',
		outDir: '.content-generator',
		emptyOutDir: true,
		rollupOptions: { output: { entryFileNames: 'generate-content.js' } },
	},
});
