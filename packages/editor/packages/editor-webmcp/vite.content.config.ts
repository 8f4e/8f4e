import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { sourceFiles } from '@8f4e/vite-plugin-sources';
import { defineConfig } from 'vite';

const examplesRoot = dirname(createRequire(import.meta.url).resolve('@8f4e/examples/package.json'));

export default defineConfig({
	plugins: [
		sourceFiles({
			name: 'reference-compiler',
			root: fileURLToPath(new URL('../../../compiler/docs/', import.meta.url)),
			include: ['**/*.md'],
		}),
		sourceFiles({
			name: 'reference-editor',
			root: fileURLToPath(new URL('../editor-core/docs/', import.meta.url)),
			include: ['**/*.md'],
		}),
		sourceFiles({ name: 'reference-blocks', root: join(examplesRoot, 'src/modules'), include: ['**/*.8f4em'] }),
		sourceFiles({ name: 'reference-projects', root: join(examplesRoot, 'src/projects'), include: ['**/*.8f4e'] }),
	],
	build: {
		ssr: 'scripts/generate-content.ts',
		outDir: '.content-generator',
		emptyOutDir: true,
		rollupOptions: { output: { entryFileNames: 'generate-content.js' } },
	},
});
