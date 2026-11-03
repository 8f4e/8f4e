import { resolve } from 'path';
import { fileURLToPath, URL } from 'url';

import { defineConfig } from 'vite';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
	server: {
		port: 3102,
		strictPort: true,
		host: 'localhost',
		open: false, // Don't auto-open browser
	},
	root: __dirname,
	esbuild: {
		target: 'esnext',
	},
	plugins: [],
	resolve: {
		alias: {
			// Point to the parent package's built output (within package boundary)
			'@8f4e/sprite-generator': resolve(__dirname, '../dist'),
			glugglugglug: resolve(__dirname, '../../glugglugglug/dist'),
			// Other packages will be resolved through npm workspaces
		},
	},
});
