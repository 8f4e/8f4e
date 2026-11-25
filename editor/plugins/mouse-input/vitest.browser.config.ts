import { playwright } from '@vitest/browser-playwright';
import { defineConfig } from 'vitest/config';

export default defineConfig({
	server: { headers: { 'Cross-Origin-Embedder-Policy': 'require-corp', 'Cross-Origin-Opener-Policy': 'same-origin' } },
	test: {
		include: ['screenshot-tests/**/*.test.ts'],
		browser: {
			provider: playwright({ contextOptions: { hasTouch: false } }),
			enabled: true,
			headless: true,
			ui: false,
			viewport: { width: 800, height: 600 },
			instances: [{ browser: 'chromium' }],
		},
	},
});
