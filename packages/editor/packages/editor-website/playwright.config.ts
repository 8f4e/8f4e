import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
	testDir: './browser-tests',
	workers: 1,
	timeout: 60_000,
	expect: { timeout: 15_000 },
	outputDir: '.playwright-results',
	use: {
		baseURL: 'http://localhost:3103',
		serviceWorkers: 'allow',
		trace: 'retain-on-failure',
	},
	projects: [
		{ name: 'chromium', use: { ...devices['Desktop Chrome'] } },
		{ name: 'android', use: { ...devices['Pixel 5'] } },
	],
	webServer: {
		command: 'vite preview --host localhost --port 3103 --strictPort',
		url: 'http://localhost:3103',
		reuseExistingServer: false,
	},
});
