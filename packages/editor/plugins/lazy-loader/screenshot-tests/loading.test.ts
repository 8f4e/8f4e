import { compileProject, parseProjectSource } from '@8f4e/compiler';
import initEditor, { type Editor, type EditorPluginContext } from '@8f4e/editor-core';
import { applyCodeBlockSourceEdits } from '@8f4e/editor-state';
import { expect, test, vi } from 'vitest';
import { createLazyPluginLoaderPlugin, hasDirective } from '../src/index';

const source = `8f4e/v1
constants env
; @pos 120 60
constantsEnd
entry main
module audio
; @pos 4 3
float[] points 8 -1 -0.5 0 0.5 1 0.5 0 -0.5
; @plot &points count(points) -1 1
moduleEnd
entryEnd`;

test.each(['project load', 'manual scan'] as const)('loads and renders plot through %s', async trigger => {
	const project = parseProjectSource(source);
	const compiled = await compileProject(project, { disableSharedMemory: true });
	const pages = Math.max(1, Math.ceil(compiled.requiredMemoryBytes / 65536));
	const memory = new WebAssembly.Memory({ initial: pages, maximum: pages });
	const { instance } = await WebAssembly.instantiate(new Uint8Array(compiled.codeBuffer), { host: { memory } });
	(instance.exports.initDefaults as CallableFunction)();
	const load = vi.fn(() => import('@8f4e/editor-plugin-plot').then(module => module.plotPlugin));
	const canvas = document.createElement('canvas');
	canvas.width = 768;
	canvas.height = 512;
	canvas.style.width = '768px';
	canvas.style.height = '512px';
	document.body.append(canvas);
	let editor: Editor | undefined;
	let context!: EditorPluginContext;
	try {
		editor = await initEditor(canvas, {
			initialEditorMode: 'edit',
			initialProject:
				trigger === 'project load'
					? project
					: parseProjectSource(source.replace('; @plot &points count(points) -1 1\n', '')),
			plugins: [
				{
					id: 'test-artifacts',
					setup: services => {
						context = services;
						Object.assign(services.store.getState().compiler, {
							memoryPlan: compiled.memoryPlan,
							memoryDefaultsByModuleId: compiled.memoryDefaultsByModuleId,
							compiledModules: compiled.compiledModules,
							compiledFunctions: compiled.compiledFunctions,
							projectMemoryExposuresByGroupPath: compiled.projectMemoryExposuresByGroupPath,
						});
						const publish = () =>
							services.events.dispatch('compilationSucceeded', { memoryRef: memory, codeBuffer: compiled.codeBuffer });
						services.events.on('init', publish);
						return () => services.events.off('init', publish);
					},
				},
				createLazyPluginLoaderPlugin([{ id: 'plot', matches: project => hasDirective(project, 'plot'), load }]),
			],
		});
		editor.pauseRendering();
		const block = editor.state.codeBlockRendering.codeBlocks.find(block => block.name === 'audio')!;
		if (trigger === 'manual scan') {
			expect(load).not.toHaveBeenCalled();
			applyCodeBlockSourceEdits(context.store, [{ codeBlock: block, code: project.modules[0].code }], {
				affectsCompilation: true,
			});
			expect(load).not.toHaveBeenCalled();
			expect(block.gaps.size).toBe(0);
			const mouse = (type: string, x: number, y: number) => {
				const rect = canvas.getBoundingClientRect();
				canvas.dispatchEvent(
					new MouseEvent(type, {
						clientX: rect.x + x,
						clientY: rect.y + y,
						bubbles: true,
						buttons: type === 'mouseup' ? 0 : 1,
					})
				);
			};
			mouse('contextmenu', 600, 400);
			await expect
				.poll(() => editor!.state.contextMenu.items.some(item => item.action === 'loadPluginsUsedByProject'))
				.toBe(true);
			editor.renderFrame();
			await expect(canvas).toMatchScreenshot('lazy-plugin-menu');
			const menu = editor.state.contextMenu;
			const index = menu.items.findIndex(item => item.action === 'loadPluginsUsedByProject');
			const x = menu.x - editor.state.viewport.x + 8;
			const y = menu.y - editor.state.viewport.y + index * editor.state.viewport.hGrid + 8;
			mouse('mousemove', x, y);
			mouse('mousedown', x, y);
			mouse('mouseup', x, y);
		}
		await expect.poll(() => block.gaps.get(3)?.size).toBe(8);
		expect(load).toHaveBeenCalledOnce();
		editor.renderFrame();
		await expect(canvas).toMatchScreenshot(`plot-after-${trigger.replace(' ', '-')}`);
	} finally {
		editor?.dispose();
		canvas.remove();
	}
});
