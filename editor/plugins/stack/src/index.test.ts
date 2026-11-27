import { compileProject, parseProjectSource } from '@8f4e/compiler';
import { textToGlyphIds } from '@8f4e/web-ui';
import { describe, expect, it, vi } from 'vitest';
import { setup } from './__tests__/setup';
import { createStackPlugin } from './index';

const plugin = createStackPlugin({ prefersReducedMotion: () => true });
const source = ['module audio', 'push 2', 'push 3', '; @stack', 'drop', 'drop', 'moduleEnd'];
describe('stack plugin', () => {
	it("does not show the active definition's stack on an overridden source block", async () => {
		const test = await setup(plugin, [
			'module audio',
			'push 1 ; @stack',
			'drop',
			'moduleEnd',
			'module audio',
			'push 9 ; @stack',
			'drop',
			'moduleEnd',
		]);
		test.render();
		expect(test.draw.drawGlyphs).not.toHaveBeenCalled();
	});
	it('shows the stack after the preceding instruction for standalone directives', async () => {
		const test = await setup(plugin, source);
		test.render();
		expect(test.draw.drawGlyphs).toHaveBeenCalledWith(
			expect.any(Number),
			expect.any(Number),
			textToGlyphIds('2, 3'),
			expect.any(Number)
		);
	});
	it.each(['stack', 's'])('uses the same instruction for inline @%s', async directive => {
		const test = await setup(plugin, ['module audio', `push 3 ; @${directive}`, 'drop', 'moduleEnd']);
		test.render();
		expect(test.draw.drawGlyphs).toHaveBeenCalledWith(
			expect.any(Number),
			expect.any(Number),
			textToGlyphIds('3'),
			expect.any(Number)
		);
	});
	it('refreshes continuation stack labels when block selection expands and collapses it', async () => {
		const test = await setup(plugin, ['module audio', '; @hide', 'push', '- 7 ; @stack', 'drop', 'moduleEnd']);
		const continuationRow = test.block.code.indexOf('- 7 ; @stack');
		expect(continuationRow).toBeGreaterThanOrEqual(0);

		test.render();
		expect(test.block.displayModel.sourceLineIndexToDisplayRow[continuationRow]).toBeUndefined();
		expect(test.draw.drawGlyphs).not.toHaveBeenCalled();

		test.store.set('project.selectedCodeBlock', test.block);
		expect(test.block.displayModel.sourceLineIndexToDisplayRow[continuationRow]).toBeDefined();
		test.render();
		expect(test.draw.drawGlyphs).toHaveBeenCalledWith(
			expect.any(Number),
			expect.any(Number),
			textToGlyphIds('7'),
			expect.any(Number)
		);

		test.store.set('project.selectedCodeBlock', undefined);
		expect(test.block.displayModel.sourceLineIndexToDisplayRow[continuationRow]).toBeUndefined();
		test.render();
		expect(test.draw.drawGlyphs).not.toHaveBeenCalled();
	});
	it('draws an empty stack and ignores unsupported arguments', async () => {
		const test = await setup(plugin, ['module audio', 'push 1', 'drop ; @stack', '; @stack extra', 'moduleEnd']);
		test.render();
		expect(test.draw.drawGlyphs).toHaveBeenCalledOnce();
		expect(test.draw.drawGlyphs).toHaveBeenCalledWith(
			expect.any(Number),
			expect.any(Number),
			textToGlyphIds(''),
			expect.any(Number)
		);
	});
	it('refreshes function analysis across recompilation, deletion, and reset', async () => {
		const functionSource = (value: number) => [
			'8f4e/v1',
			'function helper',
			`push ${value} ; @stack`,
			'drop',
			'functionEnd',
			'entry main',
			'module audio',
			'call helper',
			'moduleEnd',
			'entryEnd',
		];
		const test = await setup(plugin, functionSource(3), { name: 'helper' });
		test.render();
		expect(test.draw.drawGlyphs).toHaveBeenCalledWith(
			expect.any(Number),
			expect.any(Number),
			textToGlyphIds('3'),
			expect.any(Number)
		);

		const recompiled = await compileProject(parseProjectSource(functionSource(9).join('\n')), {
			includeStackAnalysis: true,
		});
		test.store.set('compiler.result', {
			...test.state.compiler.result,
			compiledFunctions: recompiled.compiledFunctions,
		});
		test.render();
		expect(test.draw.drawGlyphs).toHaveBeenCalledWith(
			expect.any(Number),
			expect.any(Number),
			textToGlyphIds('9'),
			expect.any(Number)
		);

		test.store.set('compiler.result', { ...test.state.compiler.result, compiledFunctions: {} });
		test.render();
		expect(test.draw.drawGlyphs).not.toHaveBeenCalled();

		test.store.set('compiler.result', { ...test.state.compiler.result, compiledFunctions: undefined });
		test.render();
		expect(test.draw.drawGlyphs).not.toHaveBeenCalled();
	});
	it('removes missing analysis after compiler metadata changes without requiring layout', async () => {
		const test = await setup(plugin, source);
		test.render();
		expect(test.draw.drawGlyphs).toHaveBeenCalled();
		const onLayoutsChanged = vi.fn();
		test.events.on('codeBlockLayoutsChanged', onLayoutsChanged);
		test.store.set('compiler.result.compiledModules', {});
		test.render();
		expect(test.draw.drawGlyphs).not.toHaveBeenCalled();
		expect(onLayoutsChanged).not.toHaveBeenCalled();
	});
	it('honors the host motion preference', async () => {
		vi.spyOn(performance, 'now').mockReturnValue(1100);
		const test = await setup(createStackPlugin({ prefersReducedMotion: () => false }), source);
		test.render();
		expect(vi.mocked(test.draw.drawSprite).mock.calls[0][4]).toBeGreaterThan(test.state.viewport.vGrid);
	});
	it('is optional, releases its contributions, and isolates editors', async () => {
		const omitted = await setup(plugin, source, { installed: false });
		omitted.render();
		expect(omitted.draw.drawGlyphs).not.toHaveBeenCalled();
		const first = await setup(plugin, source);
		const second = await setup(plugin, source);
		first.dispose();
		first.render();
		second.render();
		expect(first.draw.drawGlyphs).not.toHaveBeenCalled();
		expect(second.draw.drawGlyphs).toHaveBeenCalled();
	});
});
