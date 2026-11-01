import { compileProject, parseProjectSource } from '@8f4e/compiler';
import initEditor, { type Editor, type EditorPluginContext, getEditorBlockId } from '@8f4e/editor-core';
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

test.each(['project load', 'source edit', 'group navigation'] as const)(
	'loads and renders plot through %s',
	async trigger => {
		const project = parseProjectSource(
			trigger === 'group navigation'
				? source
						.replace('module audio', 'group audioGroup\nmodule audio')
						.replace('moduleEnd\nentryEnd', 'moduleEnd\ngroupEnd\nentryEnd')
				: source
		);
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
				initialProject:
					trigger === 'source edit'
						? parseProjectSource(source.replace('; @plot &points count(points) -1 1\n', ''))
						: project,
				plugins: [
					{
						id: 'test-artifacts',
						setup: services => {
							context = services;
							Object.assign(services.store.getState().compiler.result, {
								memoryPlan: compiled.memoryPlan,
								memoryDefaultsByModuleId: compiled.memoryDefaultsByModuleId,
								compiledModules: compiled.compiledModules,
								compiledFunctions: compiled.compiledFunctions,
								projectMemoryExposuresByGroupPath: compiled.projectMemoryExposuresByGroupPath,
							});
							const publish = () =>
								services.events.dispatch('compilationSucceeded', {
									memoryRef: memory,
								});
							services.events.on('init', publish);
							return () => services.events.off('init', publish);
						},
					},
					createLazyPluginLoaderPlugin([
						{ id: 'plot', scope: 'view', matches: directives => hasDirective(directives, 'plot'), load },
					]),
				],
			});
			canvas.dispatchEvent(new KeyboardEvent('keydown', { key: 'e' }));
			editor.pauseRendering();
			if (trigger === 'group navigation') {
				expect(load).not.toHaveBeenCalled();
				const group = editor.state.codeBlockRendering.codeBlocks.find(block => block.name === 'audioGroup')!;
				editor.navigation.openGroup(getEditorBlockId(group));
			}
			const block = editor.state.codeBlockRendering.codeBlocks.find(block => block.name === 'audio')!;
			if (trigger === 'source edit') {
				expect(load).not.toHaveBeenCalled();
				applyCodeBlockSourceEdits(context.store, [{ codeBlock: block, code: project.modules[0].code }], {
					affectsCompilation: true,
				});
			}
			await expect.poll(() => block.gaps.get(3)?.size).toBe(8);
			expect(load).toHaveBeenCalledOnce();
			editor.renderFrame();
			await expect(canvas).toMatchScreenshot(`plot-after-${trigger.replace(' ', '-')}`);
			if (trigger === 'group navigation') {
				editor.navigation.goToRoot();
				const group = editor.state.codeBlockRendering.codeBlocks.find(block => block.name === 'audioGroup')!;
				editor.navigation.openGroup(getEditorBlockId(group));
				await expect.poll(() => block.gaps.get(3)?.size).toBe(8);
				expect(load).toHaveBeenCalledOnce();
			}
		} finally {
			editor?.dispose();
			canvas.remove();
		}
	}
);
