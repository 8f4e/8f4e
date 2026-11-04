import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import { viteStaticCopy } from 'vite-plugin-static-copy';

const isolationHeaders = {
	'Cross-Origin-Embedder-Policy': 'require-corp',
	'Cross-Origin-Opener-Policy': 'same-origin',
};

export default defineConfig(() => {
	return {
		root: 'src',
		plugins: [
			VitePWA({
				injectRegister: false,
				registerType: 'prompt',
				manifest: {
					id: '/',
					name: '8f4e Editor',
					short_name: '8f4e',
					description: 'Create and run 8f4e projects, online or offline.',
					start_url: '/',
					scope: '/',
					display: 'fullscreen',
					background_color: '#000000',
					theme_color: '#000000',
					icons: [
						{ src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
						{ src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
						{ src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
					],
				},
				workbox: {
					// Download lazy chunks without importing them. Include workers, worklets, fonts, and source collections.
					globPatterns: ['**/*.{js,css,html,ico,png,svg,wasm,woff,woff2,webmanifest}'],
					globIgnores: ['blocked.html'],
					navigateFallback: 'index.html',
					navigateFallbackAllowlist: [/^\/(?:index\.html)?(?:\?.*)?$/],
					cleanupOutdatedCaches: true,
					clientsClaim: true,
					skipWaiting: false,
				},
			}),
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
		publicDir: '../public',
		preview: { headers: isolationHeaders },
		server: {
			host: '0.0.0.0',
			port: 3000,
			hmr: {
				port: 30000,
			},
			headers: isolationHeaders,
		},
	};
});
