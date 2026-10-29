import { getCodeBlockGridWidth, serializeToProject, upsertDirective } from '@8f4e/editor-state';
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

const editingActions = [
	'toggleGroupSkipExecutionDirective',
	'alignGroupBlocksInRow',
	'removeFromGroupDirective',
	'ungroupByName',
	'setGroupNonstick',
	'deleteGroup',
];

describe('grouping plugin', () => {
	it('contributes actions for the clicked group, with current labels', async () => {
		const test = setup();
		test.state.codeBlockRendering.selectedCodeBlock = test.block('other');
		const items = await test.openMenu();
		for (const action of [...editingActions, 'copyGroupBlocks']) {
			expect(items.find(item => item.action === action)?.payload?.codeBlock).toBe(test.block('first'));
		}
		expect(items.find(item => item.action === 'ungroupByName')?.title).toContain('Ungroup "audio"');
		test.events.dispatch('setGroupNonstick', { codeBlock: test.block('first'), makeNonstick: true });
		test.events.dispatch('toggleGroupSkipExecutionDirective', { codeBlock: test.block('first') });
		const updated = await test.openMenu();
		expect(updated.find(item => item.action === 'setGroupNonstick')?.title).toContain('Make Group Sticky');
		expect(updated.find(item => item.action === 'toggleGroupSkipExecutionDirective')?.title).toContain('Unskip group');
	});

	it.each([
		['; @group', false],
		['int ignored 0 ; @group audio', false],
		['; @group audio nonstick @favorite', true],
		['; @group\n; @group audio', true],
	])('derives group membership through generic directive parsing: %s', async (directive, grouped) => {
		const test = setup({ code: source.replace('; @group audio', directive) });
		expect((await test.openMenu()).some(item => item.action === 'copyGroupBlocks')).toBe(grouped);
	});

	it('uses the first valid directive and refreshes membership after source edits', () => {
		const test = setup({ code: source.replace('; @group audio', '; @group video\n; @group audio') });
		const second = test.block('second');
		const other = test.block('other');
		const originalSecondX = second.x;
		const originalOtherX = other.x;
		test.drag(test.block('first'));
		expect(second.x).toBe(originalSecondX);
		expect(other.x).toBe(originalOtherX + test.state.viewport.vGrid);
		const first = test.block('first');
		first.code = upsertDirective(first.code, 'group', ['audio']);
		test.store.set('codeBlockRendering.selectedCodeBlockForProgrammaticEdit', first);
		test.drag(first);
		expect(second.x).toBe(originalSecondX + test.state.viewport.vGrid);
	});

	it.each([
		[false, false, true],
		[false, true, false],
		[true, false, false],
		[true, true, true],
	])('selects drag targets for nonstick=%s, Alt=%s', (nonstick, alt, together) => {
		const test = setup({ code: nonstick ? source.replaceAll('; @group audio', '; @group audio nonstick') : source });
		const first = test.block('first');
		const second = test.block('second');
		const other = test.block('other');
		const x = second.x;
		const otherX = other.x;
		const revision = test.state.projectChange.revision;
		const compilerRevision = test.state.compilerInputRevision;
		const originalX = first.gridX;
		test.drag(first, alt);
		expect(first.gridX).toBe(originalX + 1);
		expect(second.x).toBe(x + (together ? test.state.viewport.vGrid : 0));
		expect(other.x).toBe(otherX);
		expect(first.code).toContain(`; @pos ${first.gridX} ${first.gridY}`);
		expect(test.state.projectChange.revision).toBe(revision + 1);
		expect(test.state.compilerInputRevision).toBe(compilerRevision);
	});

	it.each(editingActions)('does not edit in view mode: %s', async action => {
		const test = setup({ mode: 'view' });
		const before = serializeToProject(test.state);
		const items = await test.openMenu();
		expect(items.some(item => editingActions.includes(item.action!))).toBe(false);
		expect(items.some(item => item.action === 'copyGroupBlocks')).toBe(true);
		test.events.dispatch(action, { codeBlock: test.block('first'), makeNonstick: true });
		expect(serializeToProject(test.state)).toEqual(before);
	});

	it('leaves dragging disabled when editing or module dragging is disabled', () => {
		const test = setup({ mode: 'view' });
		const before = serializeToProject(test.state);
		test.drag(test.block('first'));
		expect(serializeToProject(test.state)).toEqual(before);
		test.store.set('featureFlags.editing', true);
		test.state.featureFlags.moduleDragging = false;
		test.drag(test.block('first'));
		expect(serializeToProject(test.state)).toEqual(before);
	});

	it.each([false, true])(
		'removes actions, drag rules, and paste transforms when omitted or disposed: %s',
		async installed => {
			const test = setup({ installed });
			if (installed) test.disposePlugin();
			expect((await test.openMenu()).some(item => item.action === 'copyGroupBlocks')).toBe(false);
			test.events.dispatch('closeMenu');
			const first = test.block('first');
			const secondX = test.block('second').x;
			test.drag(first);
			expect(test.block('second').x).toBe(secondX);
			const before = serializeToProject(test.state);
			for (const action of editingActions) test.events.dispatch(action, { codeBlock: first, makeNonstick: true });
			expect(serializeToProject(test.state)).toEqual(before);
			await test.paste(
				JSON.stringify([
					{ entry: 'main', code: ['module pasted', '; @group audio', 'moduleEnd'], gridCoordinates: { x: 0, y: 0 } },
					{ entry: 'main', code: ['module pasted2', '; @group audio', 'moduleEnd'], gridCoordinates: { x: 10, y: 0 } },
				])
			);
			expect(test.block('pasted').code).toContain('; @group audio');
		}
	);

	it('isolates group membership and disposal across editor instances', () => {
		const first = setup();
		const second = setup();
		first.events.dispatch('ungroupByName', { codeBlock: first.block('first') });
		first.disposePlugin();
		const x = second.block('second').x;
		second.drag(second.block('first'));
		expect(second.block('second').x).toBe(x + second.state.viewport.vGrid);
	});

	it('copies in creation order with coordinates relative to the clicked block', async () => {
		const test = setup();
		const first = test.block('first');
		const second = test.block('second');
		test.drag(first); // Changes visual order; clipboard order still follows creation.
		test.events.dispatch('copyGroupBlocks', { codeBlock: second });
		const text = test.writeClipboardText.mock.calls[0][0];
		const blocks = JSON.parse(text);
		expect(blocks.map((block: { code: string[] }) => block.code[0])).toEqual(['module first', 'module second']);
		expect(blocks[0].gridCoordinates).toEqual({ x: first.gridX - second.gridX, y: first.gridY - second.gridY });
		expect(blocks[1].gridCoordinates).toEqual({ x: 0, y: 0 });
		await test.paste(text);
		expect(test.block('first2').code).toContain('; @group audio1');
		expect(test.block('second2').code).toContain('; @group audio1');
	});

	it('deletes the whole group in place and clears references to deleted blocks', () => {
		const test = setup();
		const blocks = test.state.codeBlockRendering.codeBlocks;
		const first = test.block('first');
		test.state.codeBlockRendering.selectedCodeBlock = first;
		test.state.codeBlockRendering.draggedCodeBlock = test.block('second');
		test.state.codeBlockRendering.selectedCodeBlockForProgrammaticEdit = first;
		const revision = test.state.projectChange.revision;
		const compilerRevision = test.state.compilerInputRevision;
		test.events.dispatch('deleteGroup', { codeBlock: first });
		expect(test.state.codeBlockRendering.codeBlocks).toBe(blocks);
		expect(blocks.some(block => ['first', 'second'].includes(block.name))).toBe(false);
		expect(test.block('other')).toBeDefined();
		expect(test.state.codeBlockRendering.selectedCodeBlock).toBeUndefined();
		expect(test.state.codeBlockRendering.draggedCodeBlock).toBeUndefined();
		expect(test.state.codeBlockRendering.selectedCodeBlockForProgrammaticEdit).toBeUndefined();
		expect(test.state.projectChange.revision).toBe(revision + 1);
		expect(test.state.compilerInputRevision).toBe(compilerRevision + 1);
		test.events.dispatch('deleteGroup', { codeBlock: first });
		expect(test.state.projectChange.revision).toBe(revision + 1);
	});

	it.each(['removeFromGroupDirective', 'ungroupByName', 'setGroupNonstick'])(
		'publishes one metadata edit and no compiler change: %s',
		action => {
			const test = setup();
			const first = test.block('first');
			const revision = test.state.projectChange.revision;
			const compilerRevision = test.state.compilerInputRevision;
			test.events.dispatch(action, { codeBlock: first, makeNonstick: true });
			expect(test.state.projectChange.revision).toBe(revision + 1);
			expect(test.state.compilerInputRevision).toBe(compilerRevision);
			test.events.dispatch(action, { codeBlock: first, makeNonstick: true });
			expect(test.state.projectChange.revision).toBe(revision + 1);
			if (action === 'removeFromGroupDirective') expect(test.block('second').code).toContain('; @group audio');
			if (action === 'ungroupByName') expect(test.block('second').code).not.toContain('; @group audio');
			if (action === 'setGroupNonstick') {
				expect(test.block('second').code).toContain('; @group audio nonstick');
				test.events.dispatch(action, { codeBlock: first, makeNonstick: false });
				expect(test.block('second').code).toContain('; @group audio');
			}
		}
	);

	it('removes every group directive and preserves chained directives', () => {
		const test = setup({ code: source.replace('; @group audio', '; @group audio @favorite\n; @group duplicate') });
		const first = test.block('first');
		test.events.dispatch('removeFromGroupDirective', { codeBlock: first });
		expect(first.code).toContain('; @favorite');
		expect(first.code.some(line => line.includes('@group'))).toBe(false);
		const x = test.block('second').x;
		test.drag(first);
		expect(test.block('second').x).toBe(x);
	});

	it('toggles only module execution, leaving already skipped sources untouched', () => {
		const test = setup({
			code: source
				.replace('int value 2', '#skipExecution\nint value 2')
				.replace('entry main', 'function helper\n; @group audio\nfunctionEnd\nentry main'),
		});
		const first = test.block('first');
		const second = test.block('second');
		const skippedCode = second.code;
		const revision = test.state.projectChange.revision;
		const compilerRevision = test.state.compilerInputRevision;
		test.events.dispatch('toggleGroupSkipExecutionDirective', { codeBlock: first });
		expect(first.code).toContain('#skipExecution');
		expect(second.code).toBe(skippedCode);
		expect(test.block('helper').code).not.toContain('#skipExecution');
		expect(test.block('other').code).not.toContain('#skipExecution');
		expect(test.state.projectChange.revision).toBe(revision + 1);
		expect(test.state.compilerInputRevision).toBe(compilerRevision + 1);
		test.events.dispatch('toggleGroupSkipExecutionDirective', { codeBlock: first });
		expect(first.code).not.toContain('#skipExecution');
		expect(second.code).not.toContain('#skipExecution');
	});

	it('aligns from pre-edit widths in stable left-to-right order and publishes once', () => {
		const test = setup();
		const first = test.block('first');
		const second = test.block('second');
		const x = first.gridX + getCodeBlockGridWidth(first.code, first.minGridWidth) + 4;
		const otherCode = [...test.block('other').code];
		const revision = test.state.projectChange.revision;
		const compilerRevision = test.state.compilerInputRevision;
		test.events.dispatch('alignGroupBlocksInRow', { codeBlock: second });
		expect(second.gridX).toBe(x);
		expect(second.gridY).toBe(first.gridY);
		expect(second.x).toBe(x * test.state.viewport.vGrid);
		expect(second.code).toContain(`; @pos ${x} ${first.gridY}`);
		expect(test.block('other').code).toEqual(otherCode);
		expect(test.state.projectChange.revision).toBe(revision + 1);
		expect(test.state.compilerInputRevision).toBe(compilerRevision);
		test.events.dispatch('alignGroupBlocksInRow', { codeBlock: second });
		expect(test.state.projectChange.revision).toBe(revision + 1);
	});

	it.each(['deleteGroup', 'setGroupNonstick', 'ungroupByName', 'alignGroupBlocksInRow'])(
		'records one undo step for the entire operation and restores membership on redo: %s',
		async action => {
			vi.useFakeTimers();
			const test = setup();
			const before = serializeToProject(test.state);
			test.events.dispatch(action, { codeBlock: test.block('first'), makeNonstick: true });
			const after = serializeToProject(test.state);
			await vi.advanceTimersByTimeAsync(1000);
			expect(test.state.historyStack).toHaveLength(1);
			test.events.dispatch('undo');
			expect(serializeToProject(test.state)).toEqual(before);
			test.events.dispatch('redo');
			expect(serializeToProject(test.state)).toEqual(after);
		}
	);
});
