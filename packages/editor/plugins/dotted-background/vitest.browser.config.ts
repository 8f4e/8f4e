import { resolve } from 'node:path';
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
			screenshotDirectory: '.vitest-attachments',
			viewport: { width: 1024, height: 768 },
			instances: [{ browser: 'chromium' }],
			expect: {
				toMatchScreenshot: {
					// Bitmap atlas glyphs and procedural dots are independent of platform fonts.
					resolveScreenshotPath: ({ arg, browserName, ext, root, testFileDirectory, testFileName }) =>
						resolve(root, testFileDirectory, '__screenshots__', testFileName, `${arg}-${browserName}${ext}`),
				},
			},
		},
	},
});
