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
		include: ['src/**/*.test.ts'],
		browser: {
			provider: playwright({ contextOptions: { viewport: { width: 1024, height: 768 } } }),
			enabled: true,
			headless: true,
			ui: false,
			viewport: { width: 1024, height: 768 },
			screenshotDirectory: '.vitest-attachments',
			instances: [{ browser: 'chromium' }],
			expect: {
				toMatchScreenshot: {
					// Canvas glyphs use the same bitmap masks on every platform.
					resolveScreenshotPath: ({ arg, browserName, ext, root, testFileName }) =>
						resolve(root, 'src/__screenshots__', testFileName, `${arg}-${browserName}${ext}`),
				},
			},
		},
	},
});
