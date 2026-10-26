import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { cpus, platform, release, tmpdir } from 'node:os';
import { dirname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
import ts from 'typescript';

const workspace = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const core = 'packages/editor/packages/editor-core';
const ui = `${core}/packages/web-ui`;
const renderer = join(workspace, ui, 'packages/glugglugglug');
const args = process.argv.slice(2);
const baselineArg = args.indexOf('--baseline');
if (baselineArg < 0 || !args[baselineArg + 1])
	throw new Error('Provide --baseline <renderer git ref> for the palette-texture implementation.');
const baseline = execFileSync('git', ['rev-parse', '--verify', `${args[baselineArg + 1]}^{commit}`], {
	cwd: renderer,
	encoding: 'utf8',
}).trim();
const scratch = mkdtempSync(join(tmpdir(), 'palette-storage-'));
const transpile = source =>
	ts.transpileModule(source, {
		compilerOptions: {
			target: ts.ScriptTarget.ES2022,
			module: ts.ModuleKind.ESNext,
			rewriteRelativeImportExtensions: true,
		},
	}).outputText;
const sourceFiles = execFileSync('git', ['ls-tree', '-r', '--name-only', baseline, 'src'], {
	cwd: renderer,
	encoding: 'utf8',
})
	.trim()
	.split('\n');
for (const file of sourceFiles.filter(file => file.endsWith('.ts') && !/\.(test|spec)\.ts$/.test(file))) {
	const destination = join(scratch, file.slice(4).replace(/\.ts$/, '.js'));
	mkdirSync(dirname(destination), { recursive: true });
	writeFileSync(
		destination,
		transpile(execFileSync('git', ['show', `${baseline}:${file}`], { cwd: renderer, encoding: 'utf8' }))
	);
}

const fixture = `
import { Engine } from 'glugglugglug';
import generateSprite, { resolveSpriteIds } from '@8f4e/sprite-generator';
import { PALETTE_INDICES, resolvePalette, toPaletteBytes } from '@8f4e/editor-palette';
import { createMockState, createMockCodeBlock } from '@8f4e/editor-state-testing';
import { deriveCodeBlockCodeCells } from '@8f4e/web-ui-render-projection';
import { DrawContext } from '/ui/drawContext';
import drawBackground from '/ui/drawers/drawBackground';
import drawCodeBlocks from '/ui/drawers/codeBlocks/index';
const sprites = await generateSprite({ font: 'ibmvga8x16' });
const palette = resolvePalette({ canvas: '#0b1020', surface: '#172134cc', ink: '#e4efff', primary: '#70dbc1cc', secondary: '#edc678' });
const paletteBytes = toPaletteBytes(palette);
const tokens = ['inkBase', 'primaryBase', 'secondaryBase', 'warningBase', 'negativeBase'];
let engine, canvas, submit;
window.prepare = (scene, count) => {
 engine?.destroy(); canvas?.remove(); canvas = document.createElement('canvas');
 canvas.width = 1024; canvas.height = 768; document.body.append(canvas);
 engine = new Engine(canvas, { initialCapacity: Math.max(count, 10000) });
 engine.setPalette(paletteBytes);
 const ids = resolveSpriteIds(sprites.spriteAtlas.spriteIdentifiers, engine.setSpriteAtlas(sprites.spriteAtlas.image, sprites.spriteAtlas.lookup));
 if (scene === 'text') {
  const glyphs = new Uint16Array(count), colors = new Uint16Array(count);
  for (let i = 0; i < count; i++) { glyphs[i] = ids.font[33 + i % 94]; colors[i] = PALETTE_INDICES[tokens[i % tokens.length]]; }
  submit = () => { for (let i = 0; i < count; i++) engine.drawSprite((i % 120) * 8, (Math.floor(i / 120) % 40) * 16, glyphs[i], colors[i], 8, 16); };
 } else {
  const state = createMockState({ viewport: { x: 0, y: 0, width: 1024, height: 768, vGrid: 8, hGrid: 16 } });
  state.spriteLookups = ids; state.featureFlags.codeLineSelection = false;
  state.codeBlockRendering.selectedCodeBlock = undefined;
  const code = ['module oscillator', 'float phase 0', 'float frequency 440', '; a representative editor frame', ...Array.from({length: 28}, (_, i) => ['push frequency', 'push 0.001', 'mul', 'store phase'][i % 4]), 'end'];
  state.codeBlockRendering.codeBlocks = Array.from({ length: 6 }, (_, i) => createMockCodeBlock({ creationIndex: i, x: 8 + (i % 3) * 336, y: 8 + Math.floor(i / 3) * 384, width: 320, height: 560, code, blockType: 'module', disabled: i === 4 }));
  const renderData = { codeBlocks: new Map(state.codeBlockRendering.codeBlocks.map(block => [block.creationIndex, { codeCells: deriveCodeBlockCodeCells(block, ids) }])) };
  const memory = { int8: new Int8Array(0), uint8: new Uint8Array(0), int16: new Int16Array(0), uint16: new Uint16Array(0), int32: new Int32Array(0), float32: new Float32Array(0), float64: new Float64Array(0) };
  const draw = new DrawContext(engine, 8, ids);
  submit = () => { drawBackground(draw, state); drawCodeBlocks(draw, state, memory, renderData); };
 }
 for (let i = 0; i < 30; i++) engine.renderFrame(submit);
 engine.gl.finish();
 const gl = engine.gl, pixels = new Uint8Array(canvas.width * canvas.height * 4);
 gl.readPixels(0, 0, canvas.width, canvas.height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
 let hash = 2166136261; for (const byte of pixels) hash = Math.imul(hash ^ byte, 16777619) >>> 0;
 const debug = gl.getExtension('WEBGL_debug_renderer_info');
 let tick = performance.now(), resolution = Infinity;
 for (let i = 0; i < 10000; i++) { const next = performance.now(); if (next > tick) resolution = Math.min(resolution, next - tick); tick = next; }
 if (gl.getError() !== gl.NO_ERROR) throw new Error('WebGL error while preparing scene');
 return { ...engine.frameStats, pixelHash: hash.toString(16), paletteEntries: paletteBytes.length / 4, timerResolutionMs: resolution, gpu: debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER), version: gl.getParameter(gl.VERSION) };
};
window.measure = async samples => {
 const gl = engine.gl, ext = gl.getExtension('EXT_disjoint_timer_query_webgl2');
 const cpu = [], gpu = []; let disjoint = 0;
 for (let i = 0; i < samples; i++) {
  gl.finish();
  const query = ext ? gl.createQuery() : null;
  if (query) gl.beginQuery(ext.TIME_ELAPSED_EXT, query);
  const started = performance.now(); engine.renderFrame(submit); cpu.push(performance.now() - started);
  if (query) {
   gl.endQuery(ext.TIME_ELAPSED_EXT); gl.flush();
   const deadline = performance.now() + 5000;
   while (!gl.getQueryParameter(query, gl.QUERY_RESULT_AVAILABLE)) {
    if (performance.now() > deadline) throw new Error('GPU query timed out');
    await new Promise(done => setTimeout(done, 1));
   }
   if (!gl.getParameter(ext.GPU_DISJOINT_EXT)) gpu.push(gl.getQueryParameter(query, gl.QUERY_RESULT) / 1e6);
   else disjoint++;
   gl.deleteQuery(query);
  }
 }
 if (gl.getError() !== gl.NO_ERROR) throw new Error('WebGL error during benchmark');
 return { cpu, gpu, disjoint };
};
window.ready = true;
`;
const packages = {
	'@8f4e/sprite-generator': `${ui}/packages/sprite-generator`,
	'@8f4e/editor-palette': `${core}/packages/editor-palette`,
	'@8f4e/editor-state-testing': `${core}/packages/editor-state-testing`,
	'@8f4e/web-ui-render-projection': `${ui}/packages/render-projection`,
	'@8f4e/language-spec': 'packages/compiler/packages/language-spec',
	'@8f4e/compiler-wasm-utils': 'packages/compiler/packages/wasm-codegen/packages/wasm-utils',
	'@8f4e/tokenizer': 'packages/compiler/packages/sub-program/packages/tokenizer',
};
const server = createServer((request, response) => {
	try {
		const url = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
		response.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
		response.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
		if (url === '/baseline.html' || url === '/uniform.html') {
			const variant = url.startsWith('/baseline') ? '/baseline' : '/working';
			const imports = Object.fromEntries(
				Object.entries(packages).map(([name, directory]) => [name, `/workspace/${directory}/dist/index.js`])
			);
			imports.glugglugglug = `${variant}/index.js`;
			imports['glugglugglug/utils'] = `${variant}/utils/index.js`;
			response.setHeader('Content-Type', 'text/html');
			response.end(
				`<script type="importmap">${JSON.stringify({ imports })}</script><script type="module">${fixture}</script>`
			);
		} else {
			let base,
				relative,
				typescript = false;
			if (url.startsWith('/baseline/')) {
				base = scratch;
				relative = url.slice(10);
			} else if (url.startsWith('/working/')) {
				base = join(renderer, 'dist');
				relative = url.slice(9);
			} else if (url.startsWith('/workspace/')) {
				base = workspace;
				relative = url.slice(11);
			} else if (url.startsWith('/ui/')) {
				base = join(workspace, ui, 'src');
				relative = url.slice(4).replace(/\.js$/, '');
				relative += '.ts';
				typescript = true;
			} else throw new Error('Unknown route');
			const file = resolve(base, relative);
			if (!file.startsWith(base + sep)) throw new Error('Invalid path');
			response.setHeader('Content-Type', 'text/javascript');
			const source = readFileSync(file, 'utf8');
			response.end(typescript ? transpile(source) : source);
		}
	} catch (error) {
		response.statusCode = 404;
		response.end(error.message);
	}
});
const summary = values => {
	if (!values.length) return null;
	const sorted = [...values].sort((a, b) => a - b);
	const middle = Math.floor(sorted.length / 2);
	return {
		median: sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2,
		p10: sorted[Math.floor(sorted.length * 0.1)],
		p90: sorted[Math.floor(sorted.length * 0.9)],
		samples: sorted.length,
	};
};
let browser;
try {
	await new Promise(done => server.listen(0, '127.0.0.1', done));
	browser = await chromium.launch({ channel: 'chrome', headless: true });
	const pages = {};
	for (const variant of ['baseline', 'uniform']) {
		const page = await browser.newPage();
		page.on('pageerror', error => process.stderr.write(`${variant}: ${error.message}\n`));
		await page.goto(`http://127.0.0.1:${server.address().port}/${variant}.html`);
		await page.waitForFunction(() => window.ready);
		pages[variant] = page;
	}
	const cases = [];
	for (const [scene, count] of [
		['text', 10000],
		['text', 50000],
		['editor', 0],
	]) {
		const variants = {};
		for (const variant of Object.keys(pages)) {
			await pages[variant].bringToFront();
			variants[variant] = {
				scene: await pages[variant].evaluate(([name, size]) => window.prepare(name, size), [scene, count]),
				cpu: [],
				gpu: [],
				disjoint: 0,
			};
		}
		if (variants.baseline.scene.pixelHash !== variants.uniform.scene.pixelHash)
			throw new Error(`Pixel output differs in ${scene}/${count}`);
		if (variants.baseline.scene.uploadedInstanceBytes !== variants.uniform.scene.uploadedInstanceBytes)
			throw new Error('Instance uploads differ');
		for (let batch = 0; batch < 6; batch++) {
			for (const variant of batch % 2 ? ['uniform', 'baseline'] : ['baseline', 'uniform']) {
				await pages[variant].bringToFront();
				const measured = await pages[variant].evaluate(() => window.measure(12));
				variants[variant].cpu.push(...measured.cpu);
				variants[variant].gpu.push(...measured.gpu);
				variants[variant].disjoint += measured.disjoint;
			}
		}
		for (const value of Object.values(variants)) {
			value.cpuMs = summary(value.cpu);
			value.gpuMs = summary(value.gpu);
		}
		cases.push({ scene, requestedSprites: count || null, variants });
	}
	const result = {
		baseline,
		browser: browser.version(),
		hardware: cpus()[0].model,
		os: `${platform()} ${release()}`,
		warmupFrames: 30,
		batches: 6,
		samplesPerBatch: 12,
		alternatingBatchOrder: true,
		cases,
	};
	const outputIndex = args.indexOf('--output');
	if (outputIndex >= 0) writeFileSync(resolve(args[outputIndex + 1]), `${JSON.stringify(result, null, 2)}\n`);
	console.log(
		JSON.stringify(
			{
				...result,
				cases: cases.map(item => ({
					...item,
					variants: Object.fromEntries(
						Object.entries(item.variants).map(([name, { cpu, gpu, ...values }]) => [name, values])
					),
				})),
			},
			null,
			2
		)
	);
} finally {
	await browser?.close();
	server.close();
	rmSync(scratch, { recursive: true, force: true });
}
