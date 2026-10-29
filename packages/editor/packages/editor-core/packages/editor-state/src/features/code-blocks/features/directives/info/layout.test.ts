import { EventEmitter } from 'node:events';
import { parseProjectSource } from '@8f4e/compiler';
import { afterEach, describe, expect, it, vi } from 'vitest';
import initState from '../../../../../index';

const cleanups: Array<() => void> = [];
afterEach(() => {
	while (cleanups.length) cleanups.pop()!();
	vi.restoreAllMocks();
});

function setup(info: Record<string, unknown>) {
	const emitter = new EventEmitter();
	const events = { on: emitter.on.bind(emitter), off: emitter.off.bind(emitter), dispatch: emitter.emit.bind(emitter) };
	const store = initState(events, { callbacks: {}, runtimeRegistry: {} });
	cleanups.push(store.dispose);
	store.set('info.foo', info);
	events.dispatch('loadProject', {
		project: parseProjectSource('8f4e/v1\nentry main\nmodule foo\n; @info foo\nmoduleEnd\nentryEnd'),
	});
	const state = store.getState();
	const block = state.codeBlockRendering.codeBlocks.find(block => block.name === 'foo')!;
	return { store, state, block };
}

describe('info layout integration', () => {
	it('calculates panel geometry and reserved rows from the loaded source and info entries', () => {
		const { block } = setup({ a: 1, bar: 'foo', foo: 'something longer', skipped: { nested: true } });
		expect(block.minGridWidth).toBe(25);
		expect(block.width).toBe(200);
		expect(block.height).toBe(96);
		expect(block.gaps.get(1)?.size).toBe(3);
		expect(block.widgets.infoPanels).toEqual([
			{ width: 176, height: 48, x: 24, y: 32, id: 'foo', rowCount: 3, keyColumnWidth: 3 },
		]);
	});

	it('uses rounded float values for the calculated block and panel widths', () => {
		const { block } = setup({ value: 1.234567, skipped: { nested: true } });
		expect(block.minGridWidth).toBe(17);
		expect(block.width).toBe(136);
		expect(block.widgets.infoPanels[0].width).toBe(112);
		expect(block.gaps.get(1)?.size).toBe(1);
	});

	it('automatically recalculates rows, height, and the cache timestamp when info changes', () => {
		const { store, block } = setup({ a: 1 });
		const updatedAt = block.lastUpdated + 1000;
		vi.spyOn(Date, 'now').mockReturnValue(updatedAt);
		store.set('info.foo', { a: 1, b: 2 });
		expect(block.lastUpdated).toBe(updatedAt);
		expect(block.gaps.get(1)?.size).toBe(2);
		expect(block.height).toBe(80);
		expect(block.widgets.infoPanels[0].height).toBe(32);
	});

	it('keeps the cache timestamp when values change without changing the row count', () => {
		const { store, block } = setup({ a: 1 });
		const previousTimestamp = block.lastUpdated;
		const now = vi.spyOn(Date, 'now').mockReturnValue(previousTimestamp + 1000);
		store.set('info.foo', { a: 2 });
		expect(block.lastUpdated).toBe(previousTimestamp);
		expect(now).not.toHaveBeenCalled();
	});

	it('removes empty panels and their requests without publishing a source or compiler change', () => {
		const { store, state, block } = setup({ a: 1 });
		const projectRevision = state.projectChange.revision;
		const compilerRevision = state.compilerInputRevision;
		store.set('info.foo', {});
		expect(block.widgets.infoPanels).toEqual([]);
		expect(block.gaps.size).toBe(0);
		expect(block.minGridWidth).toBeUndefined();
		expect(block.height).toBe(48);
		expect(state.projectChange.revision).toBe(projectRevision);
		expect(state.compilerInputRevision).toBe(compilerRevision);
	});
});
