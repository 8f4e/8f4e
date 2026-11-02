import { playwright } from '@vitest/browser-playwright';
import { defineConfig } from 'vitest/config';

export default defineConfig({
	server: {
		headers: {
			'Cross-Origin-Embedder-Policy': 'require-corp',
			'Cross-Origin-Opener-Policy': 'same-origin',
		},
	},
	test: {
		include: ['browser-tests/**/*.test.ts'],
		browser: {
			provider: playwright(),
			enabled: true,
			headless: true,
			ui: false,
			screenshotDirectory: '.vitest-attachments',
			instances: [{ browser: 'chromium' }],
		},
	},
});
