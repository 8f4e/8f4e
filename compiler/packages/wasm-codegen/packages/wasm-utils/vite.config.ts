import { createEsLibConfig } from '@8f4e/config/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	...createEsLibConfig('./src/index.ts', 'dist'),
	build: {
		...createEsLibConfig('./src/index.ts', 'dist').build,
		emptyOutDir: false,
	},
});
