import { createEsLibConfig } from '@8f4e/config/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	...createEsLibConfig('./src/index.ts', 'dist'),
	build: {
		...createEsLibConfig('./src/index.ts', 'dist').build,
		emptyOutDir: false,
		rollupOptions: {
			...createEsLibConfig('./src/index.ts', 'dist').build?.rollupOptions,
			external: [
				'@8f4e/language-spec',
				'@8f4e/program-composer/internal',
				'@8f4e/project-preparser',
				'@8f4e/sub-program/internal',
				'@8f4e/tokenizer',
				'@8f4e/wasm-codegen',
			],
		},
	},
});
