import { resolve } from 'node:path';
import { playwright } from '@vitest/browser-playwright';
import { defineConfig } from 'vitest/config';

export default defineConfig({
	test: {
		include: ['screenshot-tests/**/*.test.ts'],
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
			expect: {
				toMatchScreenshot: {
					// The renderer uses uploaded bitmap sprites instead of platform fonts, so one pixel baseline is portable.
					resolveScreenshotPath: ({
						arg,
						browserName,
						ext,
						root,
						screenshotDirectory,
						testFileDirectory,
						testFileName,
					}) => resolve(root, testFileDirectory, screenshotDirectory, testFileName, `${arg}-${browserName}${ext}`),
				},
			},
		},
	},
});
