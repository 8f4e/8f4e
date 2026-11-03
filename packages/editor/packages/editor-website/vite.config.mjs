import { defineConfig } from 'vite';
import { viteStaticCopy } from 'vite-plugin-static-copy';

export default defineConfig(() => {
	return {
		root: 'src',
		plugins: [
			viteStaticCopy({
				targets: [
					{
						src: '_headers',
						dest: '',
					},
					{
						src: '_redirects',
						dest: '',
					},
					{
						src: 'blocked.html',
						dest: '',
					},
				],
			}),
		],
		build: {
			outDir: '../dist',
			emptyOutDir: true,
			manifest: true,
			rollupOptions: {
				output: {
					entryFileNames: 'assets/entries/[name]-[hash].js',
					chunkFileNames: 'assets/chunks/[name]-[hash].js',
				},
			},
		},
		publicDir: false,
		server: {
			host: '0.0.0.0',
			port: 3000,
			hmr: {
				port: 30000,
			},
			headers: {
				'Cross-Origin-Embedder-Policy': 'require-corp',
				'Cross-Origin-Opener-Policy': 'same-origin',
			},
		},
	};
});
