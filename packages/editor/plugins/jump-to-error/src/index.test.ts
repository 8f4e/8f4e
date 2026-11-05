import { EventEmitter } from 'node:events';
import initState, { EMPTY_DEFAULT_PROJECT } from '@8f4e/editor-state';
import type { CodeBlockGraphicData, InternalPointerEvent, State } from '@8f4e/editor-state-types';
import { parseProjectSource } from '@8f4e/project-preparser';
import { createEditorDrawerRegistry, type DrawContext, type MemoryViews } from '@8f4e/web-ui';
import { afterEach, expect, it, vi } from 'vitest';
import { createJumpToErrorPlugin } from './index';

const cleanups: Array<() => void> = [];
afterEach(() => {
	while (cleanups.length) cleanups.pop()!();
});

function setup() {
	const emitter = new EventEmitter();
	const events = { on: emitter.on.bind(emitter), off: emitter.off.bind(emitter), dispatch: emitter.emit.bind(emitter) };
	const store = initState(events, { callbacks: {} });
	events.dispatch('resize', { canvasWidth: 640, canvasHeight: 384 });
	events.dispatch('loadProject', {
		project: {
			...EMPTY_DEFAULT_PROJECT,
			execution: [
				{ type: 'module', entry: 'main', id: 7, code: ['module target', '; @pos 100 200', 'push 1', 'moduleEnd'] },
			],
		},
	});
	const state = store.getState();
	const block = state.codeBlockRendering.currentProject.blocks.find(block => block.name === 'target')!;
	const drawers = createEditorDrawerRegistry();
	const getErrorBounds = vi.fn((_state: State, block: CodeBlockGraphicData) => ({
		x: block.x + 24,
		y: block.y + 80,
		width: 120,
		height: 48,
	}));
	const dispose = createJumpToErrorPlugin({ getErrorBounds }).setup({
		store,
		events,
		menus: store.menus,
		directives: store.directives,
		layout: store.layout,
		loading: store.loading,
		drawers,
	});
	cleanups.push(store.dispose, dispose);
	const drawFill = vi.fn();
	const drawText = vi.fn();
	const draw = { drawFill, drawText, startGroup: vi.fn(), endGroup: vi.fn() } as unknown as DrawContext;
	const render = () => drawers.drawCanvasOverlays({ draw, state, memoryViews: {} as MemoryViews });
	const press = (overrides: Partial<InternalPointerEvent> = {}) => {
		const event = {
			x: state.viewport.width - 2 * state.viewport.vGrid,
			y: state.viewport.height - 2 * state.viewport.hGrid,
			buttons: 1,
			stopPropagation: false,
			...overrides,
		} as InternalPointerEvent;
		events.dispatch('pointerdown', event);
		return event;
	};
	const addError = () =>
		store.set('codeErrors.custom', [{ codeBlockId: block.creationIndex, lineNumber: 2, message: 'Error message' }]);
	return { store, state, block, events, render, drawFill, drawText, press, addError, dispose, getErrorBounds };
}

it('shows a viewport-fixed button only while a contributed source error exists', () => {
	const test = setup();
	test.render();
	expect(test.drawText).not.toHaveBeenCalled();
	test.addError();
	test.render();
	expect(test.drawText.mock.calls.at(-1)?.[2]).toBe('Jump to error');
	const first = test.drawFill.mock.calls.at(-1);
	test.state.viewport.x = 1000;
	test.state.viewport.y = 2000;
	test.render();
	expect(test.drawFill.mock.calls.at(-1)).toEqual(first);
	test.store.set('codeErrors.custom', []);
	test.drawText.mockClear();
	test.render();
	expect(test.drawText).not.toHaveBeenCalled();
});

it('centers the message rectangle, selects the block, and preserves source revisions', () => {
	const test = setup();
	test.addError();
	const revision = test.state.projectChange.revision;
	const compilerRevision = test.state.compilerInputRevision;
	test.state.viewportAnimation.active = true;
	expect(test.press().stopPropagation).toBe(true);
	expect(test.state.codeBlockRendering.selectedCodeBlock).toBe(test.block);
	// Navigation uses the supplied rectangle rather than deriving presentation geometry.
	expect(test.getErrorBounds).toHaveBeenCalledWith(test.state, test.block, test.state.codeErrors.custom[0]);
	expect(test.state.viewport.x).toBe(test.block.x + 24 + 60 - 320);
	expect(test.state.viewport.y).toBe(test.block.y + 80 + 24 - 192);
	expect(test.state.viewportAnimation.active).toBe(false);
	expect(test.state.projectChange.revision).toBe(revision);
	expect(test.state.compilerInputRevision).toBe(compilerRevision);
	const release = { stopPropagation: false } as InternalPointerEvent;
	test.events.dispatch('pointerup', release);
	expect(release.stopPropagation).toBe(true);
});

it('ignores outside presses, non-primary presses, and stale errors', () => {
	const test = setup();
	test.addError();
	expect(test.press({ x: 0, y: 0 }).stopPropagation).toBe(false);
	expect(test.press({ buttons: 2 }).stopPropagation).toBe(false);
	test.store.set('codeErrors.custom', [{ codeBlockId: 999, lineNumber: 2, message: 'Stale' }]);
	expect(test.press().stopPropagation).toBe(false);
	test.render();
	expect(test.drawText).not.toHaveBeenCalled();
});

it('opens a nested project for document errors and returns to root for root-scope errors', () => {
	const test = setup();
	test.events.dispatch('loadProject', {
		project: parseProjectSource(`8f4e/v1
pass missing
entry main
group audio
entry main
group nested
entry main
module child
push 1
moduleEnd
entryEnd
groupEnd
entryEnd
groupEnd
entryEnd`),
	});
	const root = test.state.codeBlockRendering.rootProject;
	const audio = root.blocks.find(block => block.name === 'audio')!;
	const nested = audio.childProject!.blocks.find(block => block.name === 'nested')!;
	const child = nested.childProject!.blocks[0];
	test.store.set('codeErrors.custom', [{ codeBlockId: child.creationIndex, lineNumber: 1, message: 'Child error' }]);
	test.press();
	expect(test.state.codeBlockRendering.currentProject).toBe(nested.childProject);
	expect(test.state.codeBlockRendering.selectedCodeBlock).toBe(child);
	test.store.set('codeErrors.custom', [
		{ codeBlockId: -1, projectGroupPath: '', lineNumber: 0, message: 'Root error' },
	]);
	test.press();
	expect(test.state.codeBlockRendering.currentProject).toBe(root);
	expect(test.state.codeBlockRendering.selectedCodeBlock?.isProjectScope).toBe(true);
});

it('releases its drawer, subscriptions, and input handlers on disposal', () => {
	const test = setup();
	test.addError();
	test.dispose();
	test.render();
	expect(test.drawText).not.toHaveBeenCalled();
	expect(test.press().stopPropagation).toBe(false);
	expect(test.state.codeErrors.custom).toHaveLength(1);
});

it.each(['hidden', 'dialog', 'menu'])('leaves %s overlay input alone', blocked => {
	const test = setup();
	test.addError();
	if (blocked === 'hidden') test.state.featureFlags.canvasOverlays = false;
	if (blocked === 'dialog')
		test.events.dispatch('addDialog', { id: 'modal', title: 'Modal', text: 'Wait', buttons: [] });
	if (blocked === 'menu') test.state.contextMenu.open = true;
	test.press();
	expect(test.getErrorBounds).not.toHaveBeenCalled();
});
