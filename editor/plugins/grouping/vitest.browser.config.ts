import { playwright } from '@vitest/browser-playwright';
import { defineConfig } from 'vitest/config';

export default defineConfig({
	test: {
		include: ['browser-tests/**/*.test.ts'],
		browser: {
			provider: playwright({
				contextOptions: {
					viewport: { width: 1024, height: 768 },
				},
			}),
			enabled: true,
			headless: true,
			ui: false,
			viewport: { width: 1024, height: 768 },
			instances: [{ browser: 'chromium' }],
		},
	},
});
