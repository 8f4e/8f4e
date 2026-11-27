import { playwright } from '@vitest/browser-playwright';
import { defineConfig } from 'vitest/config';

export default defineConfig({
	test: {
		include: ['screenshot-tests/**/*.test.ts'],
		browser: {
			provider: playwright(),
			enabled: true,
			headless: true,
			ui: false,
			instances: [{ browser: 'chromium' }],
		},
	},
});
