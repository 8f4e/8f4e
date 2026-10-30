import { expect, test } from '@playwright/test';

const testCases = ['sprite-sheet-with-6x10-font', 'sprite-sheet-with-8x16-font', 'sprite-atlas'];

test.describe('Sprite Generator Screenshot Tests', () => {
	for (const testCase of testCases) {
		test(`should display sprite generator for ${testCase}`, async ({ page }) => {
			await page.goto(`/test-cases/${testCase}.html`);
			await expect(page.locator('body')).toHaveAttribute('data-ready', 'true');
			await expect(page).toHaveScreenshot(`${testCase}.png`);
		});
	}
});

test('generates the migrated example palettes with predefined sprite shades', async ({ page }) => {
	page.on('pageerror', error => console.error(error));
	await page.goto('/test-cases/palette-themes.html');
	await expect(page.locator('body')).toHaveAttribute('data-ready', 'true');
	await expect(page.locator('canvas')).toHaveCount(12);
	await expect(page).toHaveScreenshot('palette-themes.png', { fullPage: true });
});
