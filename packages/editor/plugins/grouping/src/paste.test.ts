import { afterEach, describe, expect, it, vi } from 'vitest';
import { setup as createEditor, source } from './__tests__/editor';

const cleanups: Array<() => void> = [];
function setup(options?: Parameters<typeof createEditor>[0]) {
	const editor = createEditor(options);
	cleanups.push(editor.dispose);
	return editor;
}
afterEach(() => {
	while (cleanups.length) cleanups.pop()!();
	vi.useRealTimers();
});

describe('grouping copy and paste', () => {
	it('renames colliding groups once per batch, preserving modes and chained directives', async () => {
		const test = setup();
		const revision = test.state.projectChange.revision;
		const incoming = [
			{
				entry: 'main',
				code: ['module pasted', '; @group audio nonstick @favorite', 'moduleEnd'],
				gridCoordinates: { x: 0, y: 0 },
			},
			{ entry: 'main', code: ['module pasted2', '; @group audio', 'moduleEnd'], gridCoordinates: { x: 15, y: 5 } },
			{ entry: 'main', code: ['module pasted3', '; @group audio1', 'moduleEnd'], gridCoordinates: { x: 30, y: 0 } },
			{ entry: 'main', code: ['module pasted4', '; @group video', 'moduleEnd'], gridCoordinates: { x: 45, y: 0 } },
		];
		await test.paste(JSON.stringify(incoming));
		expect(test.block('pasted').code).toContain('; @group audio1 nonstick @favorite');
		expect(test.block('pasted2').code).toContain('; @group audio1');
		expect(test.block('pasted3').code).toContain('; @group audio2');
		expect(test.block('pasted4').code).toContain('; @group video1');
		expect(test.block('first').code).toContain('; @group audio');
		expect(test.block('pasted2').gridX - test.block('pasted').gridX).toBe(15);
		expect(test.block('pasted2').gridY - test.block('pasted').gridY).toBe(5);
		expect(test.state.projectChange.revision).toBe(revision + 1);
		const x = test.block('pasted2').x;
		test.drag(test.block('pasted'), true); // Pasted nonstick membership is already derived.
		expect(test.block('pasted2').x).toBe(x + test.state.viewport.vGrid);
	});

	it('keeps available names and renames colliding trailing group comments', async () => {
		const test = setup();
		await test.paste(
			JSON.stringify([
				{ entry: 'main', code: ['module pasted', '; @group fresh', 'moduleEnd'], gridCoordinates: { x: 0, y: 0 } },
				{
					entry: 'main',
					code: ['module pasted2', 'int ignored 0 ; @group audio', 'moduleEnd'],
					gridCoordinates: { x: 10, y: 0 },
				},
			])
		);
		expect(test.block('pasted').code).toContain('; @group fresh');
		expect(test.block('pasted2').code).toContain('int ignored 0 ; @group audio1');
	});

	it('keeps nested project groups and their child grouping independent', async () => {
		const nested = `group nested
; @pos 90 3
; @group audio
module child
; @pos 4 3
; @group audio
moduleEnd
module child2
; @pos 30 3
; @group audio
moduleEnd
groupEnd`;
		const test = setup({ code: source.replace('entry main', `entry main\n${nested}`) });
		const root = test.state.codeBlockRendering.currentProject.blocks;
		const owner = test.block('nested');
		test.events.dispatch('copyGroupBlocks', { codeBlock: test.block('first') });
		const clipboard = test.writeClipboardText.mock.calls[0][0];
		await test.paste(clipboard);
		const pasted = test.block('nested1');
		expect(pasted.code).toContain('; @group audio1');
		expect(pasted.childProject?.blocks?.find(block => block.name === 'child')?.code).toContain('; @group audio');
		const rootCode = [...test.block('first').code];
		test.events.dispatch('openProjectGroup', { codeBlock: owner });
		const child = test.block('child');
		const x = test.block('child2').x;
		test.drag(child);
		expect(test.block('child2').x).toBe(x + test.state.viewport.vGrid);
		test.events.dispatch('ungroupByName', { codeBlock: child });
		expect(test.block('child2').code).not.toContain('; @group audio');
		test.events.dispatch('goToParentProjectGroup');
		expect(test.state.codeBlockRendering.currentProject.blocks).toBe(root);
		expect(test.block('first').code).toEqual(rootCode);
	});

	it('restores copied group membership and relative positions through undo and redo', async () => {
		vi.useFakeTimers();
		const test = setup();
		test.events.dispatch('copyGroupBlocks', { codeBlock: test.block('second') });
		await test.paste(test.writeClipboardText.mock.calls[0][0]);
		await vi.advanceTimersByTimeAsync(1000);
		expect(test.state.historyStack).toHaveLength(1);
		test.events.dispatch('undo');
		expect(test.block('first2')).toBeUndefined();
		test.events.dispatch('redo');
		const x = test.block('second2').x;
		test.drag(test.block('first2'));
		expect(test.block('second2').x).toBe(x + test.state.viewport.vGrid);
	});
});
