import { expect, test } from '@playwright/test';

const testCases = ['sprite-sheet-with-x11miscfixed6x10-font', 'sprite-sheet-with-8x16-font', 'sprite-atlas'];

test('previews the sci-fi fonts at an integer pixel scale', async ({ page }) => {
	await page.goto('/test-cases/sci-fi-fonts.html');
	await expect(page.locator('body')).toHaveAttribute('data-ready', 'true');
	await expect(page.locator('canvas')).toHaveCount(3);
	await expect(page).toHaveScreenshot('sci-fi-fonts.png', { fullPage: true });
});

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
