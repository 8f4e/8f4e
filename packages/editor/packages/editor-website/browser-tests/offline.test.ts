import { readdir, readFile, writeFile } from 'node:fs/promises';
import type { DefaultEditorInstance } from '@8f4e/editor-default';
import type { WebMcpTool } from '@8f4e/editor-webmcp';
import { expect, type Page, test } from '@playwright/test';

declare global {
	interface Window {
		state: DefaultEditorInstance['state'];
		pwaTools: Map<string, WebMcpTool>;
	}
}

async function waitForEditor(page: Page) {
	await page.waitForFunction(() => window.pwaTools?.has('get_compiler_diagnostics'));
	await expect.poll(() => page.evaluate(() => window.state.compiler.isCompiling)).toBe(false);
}

async function call(page: Page, name: string, args: Record<string, unknown> = {}) {
	return page.evaluate(({ name, args }) => window.pwaTools.get(name)!.execute(args), { name, args });
}

async function insert(page: Page, code: string, entry?: string) {
	// Exercise the editor API without depending on desktop keyboard input on touch devices.
	await page.evaluate(() => {
		window.state.editorMode = 'edit';
	});
	await call(page, 'get_project');
	expect(await call(page, 'apply_edits', { edits: [{ operation: 'insert', code, ...(entry ? { entry } : {}) }] })).toBe(
		'Edits applied.'
	);
}

test.beforeEach(async ({ context, page }) => {
	await context.addInitScript(() => {
		window.pwaTools = new Map();
		Object.defineProperty(document, 'modelContext', {
			value: { registerTool: (tool: WebMcpTool) => window.pwaTools.set(tool.name, tool) },
		});
	});
	await page.goto('/');
	await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
	await waitForEditor(page);
	await expect(page.locator('#pwa-notice')).toHaveCount(0);
	expect(await page.evaluate(() => window.state.dialogStack)).toEqual([]);
});

test('installs a complete offline cache and cold-starts with lazy plugins and a runtime', async ({ context, page }) => {
	const manifest = await page.evaluate(async () => (await fetch('/manifest.webmanifest')).json());
	expect(manifest).toMatchObject({ id: '/', start_url: '/', scope: '/', display: 'standalone' });
	expect(manifest.icons).toEqual(
		expect.arrayContaining([
			expect.objectContaining({ sizes: '192x192' }),
			expect.objectContaining({ sizes: '512x512', purpose: 'maskable' }),
		])
	);
	const iconSizes = await page.evaluate(async (icons: Array<{ src: string }>) => {
		return Promise.all(
			icons.map(async icon => {
				const bitmap = await createImageBitmap(await (await fetch(icon.src)).blob());
				return `${bitmap.width}x${bitmap.height}`;
			})
		);
	}, manifest.icons);
	expect(iconSizes).toEqual(['192x192', '512x512', '512x512']);
	const assets = (await readdir('dist/assets', { recursive: true })).filter(path => /\.(js|css|ico)$/.test(path));
	const cached = await page.evaluate(async () => {
		const names = await caches.keys();
		const entries = await Promise.all(names.map(async name => (await caches.open(name)).keys()));
		return entries.flat().map(request => new URL(request.url).pathname);
	});
	for (const asset of assets) expect(cached).toContain(`/assets/${asset}`);

	// The plugin is downloaded by the service worker, but has not been imported by the page.
	const plotAsset = (
		await Promise.all(assets.map(async path => ({ path, code: await readFile(`dist/assets/${path}`, 'utf8') })))
	).find(asset => asset.code.includes('id:"plot",setup:'))!.path;
	const imported = await page.evaluate(() => performance.getEntriesByType('resource').map(entry => entry.name));
	expect(imported.some(url => url.endsWith(plotAsset))).toBe(false);

	await context.setOffline(true);
	await page.close();
	const offlinePage = await context.newPage();
	const failures: string[] = [];
	offlinePage.on('pageerror', error => failures.push(error.message));
	await offlinePage.goto('/?offline-launch=1');
	await waitForEditor(offlinePage);
	expect(await offlinePage.evaluate(() => crossOriginIsolated)).toBe(true);
	const pluginResponse = offlinePage.waitForResponse(response => response.url().endsWith(plotAsset));
	await insert(
		offlinePage,
		'module offlinePlot\n; @pos 3 3\nfloat[] points 4 -1.0 0.0 1.0 0.0\n; @plot &points 4 -1 1\nmoduleEnd'
	);
	expect((await pluginResponse).fromServiceWorker()).toBe(true);
	await expect
		.poll(() =>
			offlinePage.evaluate(
				() =>
					window.state.codeBlockRendering.currentProject.blocks.find(block => block.name === 'offlinePlot')?.gaps.get(3)
						?.size
			)
		)
		.toBeGreaterThan(0);
	await insert(offlinePage, 'note offlineSettings\n; @config font 6x10\n; @config testRuntime.enabled true\nnoteEnd');
	await insert(offlinePage, 'includes\ninclude std/math/exp2\nincludesEnd');
	await insert(offlinePage, 'module offlineAssertions\npush 0.0\ncall exp2\nassertEqual 1.0\nmoduleEnd', 'test');
	await expect.poll(() => offlinePage.evaluate(() => window.state.info.testRuntime?.status)).toBe('passed');
	expect(await offlinePage.evaluate(() => window.state.codeErrors)).toMatchObject({
		compilationErrors: [],
		editorDirectiveErrors: [],
	});
	await offlinePage.reload();
	await waitForEditor(offlinePage);
	expect(await call(offlinePage, 'get_project')).toContain('module offlinePlot');
	await expect.poll(() => offlinePage.evaluate(() => window.state.info.testRuntime?.status)).toBe('passed');
	expect(failures).toEqual([]);
	await offlinePage.screenshot({ path: '.playwright-results/offline-editor.png' });
});

test('waits for a requested update and preserves the saved project and binary cache', async ({ context, page }) => {
	await insert(page, 'module savedBeforeUpdate\nint value 7\nmoduleEnd');
	const otherPage = await context.newPage();
	await otherPage.goto('/');
	await waitForEditor(otherPage);
	await page.evaluate(async () => {
		const binaryCache = await caches.open('8f4e-binary-assets');
		await binaryCache.put('/sample.bin', new Response(new Uint8Array([1, 2, 3])));
	});
	const worker = await readFile('dist/sw.js', 'utf8');
	try {
		await writeFile('dist/sw.js', `${worker}\n// Update test ${Date.now()}\n`);
		await page.evaluate(async () => (await navigator.serviceWorker.getRegistration())!.update());
		await expect.poll(() => page.evaluate(() => window.state.dialog.id)).toBe('pwa-update');
		expect(await page.evaluate(() => window.state.dialog.title)).toBe('Update available');
		await page.locator('#glcanvas').screenshot({ path: '.playwright-results/update-dialog.png' });
		expect(await page.evaluate(async () => !!(await navigator.serviceWorker.getRegistration())?.waiting)).toBe(true);
		expect(await call(page, 'get_project')).toContain('module savedBeforeUpdate');
		expect(await call(otherPage, 'get_project')).toContain('module savedBeforeUpdate');
		// Click Later in the centered canvas dialog, then reopen with the update still waiting in the other window.
		const viewport = page.viewportSize()!;
		await page.locator('#glcanvas').click({ position: { x: viewport.width * 0.7, y: viewport.height * 0.55 } });
		await expect.poll(() => page.evaluate(() => window.state.dialogStack.length)).toBe(0);
		expect(await page.evaluate(async () => !!(await navigator.serviceWorker.getRegistration())?.waiting)).toBe(true);
		await page.reload();
		await waitForEditor(page);
		await expect.poll(() => page.evaluate(() => window.state.dialog.id)).toBe('pwa-update');
		await Promise.all([
			page.waitForEvent('load'),
			otherPage.waitForEvent('load'),
			page.locator('#glcanvas').click({ position: { x: viewport.width * 0.62, y: viewport.height * 0.55 } }),
		]);
		await waitForEditor(page);
		await waitForEditor(otherPage);
		expect(await call(page, 'get_project')).toContain('module savedBeforeUpdate');
		expect(await call(otherPage, 'get_project')).toContain('module savedBeforeUpdate');
		expect(
			await page.evaluate(async () => {
				const response = await (await caches.open('8f4e-binary-assets')).match('/sample.bin');
				return Array.from(new Uint8Array(await response!.arrayBuffer()));
			})
		).toEqual([1, 2, 3]);
	} finally {
		await writeFile('dist/sw.js', worker);
	}
});
