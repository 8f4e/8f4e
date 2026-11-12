import { EventEmitter } from 'node:events';
import type { EditorPluginContext } from '@8f4e/editor-core';
import initState, { applyCodeBlockSourceEdits, EMPTY_DEFAULT_PROJECT } from '@8f4e/editor-state';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createSuccessMessage, FakeWorker } from './__tests__/helpers';
import { createCompilerPlugin } from './index';

const cleanups: Array<() => void> = [];

async function setup(lines: string[]) {
	const emitter = new EventEmitter();
	const events = { on: emitter.on.bind(emitter), off: emitter.off.bind(emitter), dispatch: emitter.emit.bind(emitter) };
	const store = initState(events, { callbacks: {} });
	cleanups.push(store.dispose);
	const worker = new FakeWorker();
	const compiler = createCompilerPlugin({ createWorker: () => worker as unknown as Worker });
	cleanups.push(
		compiler.plugin.setup({
			store,
			events,
			menus: store.menus,
			directives: store.directives,
			layout: store.layout,
			loading: store.loading,
			drawers: {} as EditorPluginContext['drawers'],
		})
	);
	events.dispatch('loadProject', {
		project: {
			...EMPTY_DEFAULT_PROJECT,
			execution: [{ type: 'module', id: 0, entry: 'main', code: ['module test', ...lines, 'moduleEnd'] }],
		},
	});
	await vi.advanceTimersByTimeAsync(500);
	expect(worker.postedMessages).toHaveLength(1);
	worker.emitMessage(createSuccessMessage(new Uint8Array([0]), new WebAssembly.Memory({ initial: 1 })));
	const state = store.getState();
	const block = state.codeBlockRendering.rootProject.blocks.find(block => block.blockType === 'module')!;
	return { store, events, worker, state, block };
}

describe('source edit compilation invalidation', () => {
	beforeEach(() => vi.useFakeTimers());
	afterEach(() => {
		while (cleanups.length) cleanups.pop()!();
		vi.useRealTimers();
	});

	it.each([
		{ name: 'inserting an ordinary comment', before: ['push 1'], after: ['; explanation', 'push 1'] },
		{ name: 'removing an ordinary comment', before: ['; explanation', 'push 1'], after: ['push 1'] },
		{ name: 'inserting a blank line', before: ['push 1'], after: ['', 'push 1'] },
		{ name: 'removing a blank line', before: ['', 'push 1'], after: ['push 1'] },
		{ name: 'adding a directive', before: ['push 1'], after: ['; @favorite', 'push 1'] },
		{ name: 'removing a directive', before: ['; @favorite', 'push 1'], after: ['push 1'] },
		{ name: 'changing a directive in place', before: ['; @pos 0 0', 'push 1'], after: ['; @pos 2 3', 'push 1'] },
		{ name: 'replacing a comment with a directive', before: ['; explanation'], after: ['; @favorite'] },
		{ name: 'replacing a directive with a comment', before: ['; @favorite'], after: ['; explanation'] },
		{ name: 'removing an inline directive', before: ['push 1 ; @favorite'], after: ['push 1'] },
		{ name: 'changing executable source', before: ['push 1'], after: ['push 2'] },
		{ name: 'reordering instructions', before: ['push 1', 'push 2'], after: ['push 2', 'push 1'] },
		{
			name: 'shifting instructions without changing the line count',
			before: ['; explanation', 'push 1', ''],
			after: ['push 1', '; explanation', ''],
		},
		{
			name: 'changing directive continuation arguments',
			before: ['; @unknown', '; - first'],
			after: ['; @unknown', '; - second'],
		},
	])('revises and schedules compilation after $name', async ({ before, after }) => {
		const { store, events, worker, state, block } = await setup(before);
		const revision = state.compilerInputRevision;
		const onInputChanged = vi.fn();
		events.on('compilationInputChanged', onInputChanged);
		applyCodeBlockSourceEdits({ store, events }, [{ codeBlock: block, code: ['module test', ...after, 'moduleEnd'] }]);
		expect(state.compilerInputRevision).toBe(revision + 1);
		expect(onInputChanged).toHaveBeenCalledTimes(1);
		await vi.advanceTimersByTimeAsync(499);
		expect(worker.postedMessages).toHaveLength(1);
		await vi.advanceTimersByTimeAsync(1);
		expect(worker.postedMessages).toHaveLength(2);
	});

	it('publishes in-place ordinary comment edits without revising or scheduling compilation', async () => {
		const { store, events, worker, state, block } = await setup(['; explanation', 'push 1', '  ; another comment']);
		const revision = state.compilerInputRevision;
		const projectRevision = state.projectChange.revision;
		const onInputChanged = vi.fn();
		const onSourcesChanged = vi.fn();
		events.on('compilationInputChanged', onInputChanged);
		events.on('codeBlockSourcesChanged', onSourcesChanged);
		applyCodeBlockSourceEdits({ store, events }, [
			{ codeBlock: block, code: ['module test', '; updated explanation', 'push 1', '; updated comment', 'moduleEnd'] },
		]);
		expect(state.projectChange.revision).toBe(projectRevision + 1);
		expect(onSourcesChanged).toHaveBeenCalledExactlyOnceWith({ codeBlocks: [block] });
		expect(state.compilerInputRevision).toBe(revision);
		expect(onInputChanged).not.toHaveBeenCalled();
		await vi.advanceTimersByTimeAsync(1000);
		expect(worker.postedMessages).toHaveLength(1);
	});

	it('leaves an identical source replacement unchanged', async () => {
		const { store, events, worker, state, block } = await setup(['; explanation', 'push 1']);
		const revision = state.compilerInputRevision;
		const projectRevision = state.projectChange.revision;
		expect(applyCodeBlockSourceEdits({ store, events }, [{ codeBlock: block, code: [...block.code] }])).toBe(false);
		expect(state.compilerInputRevision).toBe(revision);
		expect(state.projectChange.revision).toBe(projectRevision);
		await vi.advanceTimersByTimeAsync(1000);
		expect(worker.postedMessages).toHaveLength(1);
	});
});
