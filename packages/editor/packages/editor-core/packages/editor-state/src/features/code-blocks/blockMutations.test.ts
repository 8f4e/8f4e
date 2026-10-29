import { createMockCodeBlock, createMockState } from '@8f4e/editor-state-testing';
import type { State } from '@8f4e/editor-state-types';
import createStateManager from '@8f4e/state-manager';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { deleteCodeBlocks } from './deleteCodeBlocks';
import { applyCodeBlockSourceEdits } from './sourceEdits';

const cleanups: Array<() => void> = [];
function setup() {
	const first = createMockCodeBlock({ code: ['module first', 'moduleEnd'], lastUpdated: 1 });
	const second = createMockCodeBlock({ code: ['module second', 'moduleEnd'], lastUpdated: 1 });
	const untouched = createMockCodeBlock({ code: ['module untouched', 'moduleEnd'], lastUpdated: 1 });
	const state = createMockState();
	state.codeBlockRendering.rootCodeBlocks.push(first, second, untouched);
	state.codeBlockRendering.codeBlocks = state.codeBlockRendering.rootCodeBlocks;
	const store = createStateManager<State>(state);
	cleanups.push(store.dispose);
	return { store, state, first, second, untouched };
}
afterEach(() => {
	while (cleanups.length) cleanups.pop()!();
});

describe('block source edits', () => {
	it.each([false, true])(
		'refreshes changed blocks before publishing the whole batch: affectsCompilation=%s',
		affectsCompilation => {
			const { store, state, first, second, untouched } = setup();
			const firstCode = ['module first', 'int value 1', 'moduleEnd'];
			const secondCode = ['module second', 'int value 2', 'moduleEnd'];
			const untouchedCode = untouched.code;
			const refreshed: unknown[] = [];
			const onCompilerChange = vi.fn(() => {
				expect(first.code).toEqual(firstCode);
				expect(second.code).toEqual(secondCode);
			});
			const onProjectChange = vi.fn(() => {
				expect(refreshed).toEqual([first, second]);
				expect(state.compilerInputRevision).toBe(affectsCompilation ? 1 : 0);
			});
			store.subscribe('codeBlockRendering.selectedCodeBlockForProgrammaticEdit', () => {
				refreshed.push(state.codeBlockRendering.selectedCodeBlockForProgrammaticEdit);
			});
			store.subscribe('compilerInputRevision', onCompilerChange);
			store.subscribe('projectChange', onProjectChange);
			expect(
				applyCodeBlockSourceEdits(
					store,
					[
						{ codeBlock: first, code: firstCode },
						{ codeBlock: untouched, code: [...untouchedCode] },
						{ codeBlock: second, code: secondCode },
					],
					{ affectsCompilation }
				)
			).toBe(true);
			expect(first.lastUpdated).toBeGreaterThan(1);
			expect(second.lastUpdated).toBeGreaterThan(1);
			expect(untouched.lastUpdated).toBe(1);
			expect(untouched.code).toBe(untouchedCode);
			expect(onCompilerChange).toHaveBeenCalledTimes(affectsCompilation ? 1 : 0);
			expect(onProjectChange).toHaveBeenCalledTimes(1);
			expect(state.projectChange.revision).toBe(1);
		}
	);

	it('does not refresh or publish empty and unchanged batches', () => {
		const { store, state, first } = setup();
		const onRefresh = vi.fn();
		store.subscribe('codeBlockRendering.selectedCodeBlockForProgrammaticEdit', onRefresh);
		expect(applyCodeBlockSourceEdits(store, [], { affectsCompilation: true })).toBe(false);
		expect(
			applyCodeBlockSourceEdits(store, [{ codeBlock: first, code: [...first.code] }], { affectsCompilation: true })
		).toBe(false);
		expect(first.lastUpdated).toBe(1);
		expect(onRefresh).not.toHaveBeenCalled();
		expect(state.projectChange.revision).toBe(0);
		expect(state.compilerInputRevision).toBe(0);
	});
});

describe('block deletion', () => {
	it('removes a batch from the visible nested slice in place and clears deleted references before publishing', () => {
		const { store, state, first, second, untouched } = setup();
		const nested = [first, second, untouched];
		const owner = createMockCodeBlock({ name: 'owner', nestedProjectCodeBlocks: nested });
		const root = state.codeBlockRendering.rootCodeBlocks;
		root.splice(0, root.length, owner);
		state.codeBlockRendering.codeBlocks = nested;
		state.codeBlockRendering.selectedCodeBlock = first;
		state.codeBlockRendering.draggedCodeBlock = second;
		state.codeBlockRendering.selectedCodeBlockForProgrammaticEdit = first;
		const onProjectChange = vi.fn(() => {
			expect(nested).toEqual([untouched]);
			expect(state.codeBlockRendering.selectedCodeBlock).toBeUndefined();
			expect(state.codeBlockRendering.draggedCodeBlock).toBeUndefined();
			expect(state.codeBlockRendering.selectedCodeBlockForProgrammaticEdit).toBeUndefined();
			expect(state.compilerInputRevision).toBe(1);
		});
		store.subscribe('projectChange', onProjectChange);
		expect(deleteCodeBlocks(store, [first, second])).toBe(true);
		expect(owner.nestedProjectCodeBlocks).toBe(nested);
		expect(state.codeBlockRendering.codeBlocks).toBe(nested);
		expect(state.codeBlockRendering.rootCodeBlocks).toBe(root);
		expect(root).toEqual([owner]);
		expect(onProjectChange).toHaveBeenCalledTimes(1);
	});

	it('keeps references to surviving blocks and ignores repeated deletion', () => {
		const { store, state, first, second } = setup();
		state.codeBlockRendering.selectedCodeBlock = second;
		state.codeBlockRendering.draggedCodeBlock = second;
		state.codeBlockRendering.selectedCodeBlockForProgrammaticEdit = second;
		expect(deleteCodeBlocks(store, [first])).toBe(true);
		expect(state.codeBlockRendering.selectedCodeBlock).toBe(second);
		expect(state.codeBlockRendering.draggedCodeBlock).toBe(second);
		expect(state.codeBlockRendering.selectedCodeBlockForProgrammaticEdit).toBe(second);
		expect(deleteCodeBlocks(store, [first])).toBe(false);
		expect(deleteCodeBlocks(store, [])).toBe(false);
		expect(state.projectChange.revision).toBe(1);
		expect(state.compilerInputRevision).toBe(1);
	});
});
