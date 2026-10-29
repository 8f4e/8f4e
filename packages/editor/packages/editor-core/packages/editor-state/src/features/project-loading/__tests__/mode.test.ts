import { EventEmitter } from 'node:events';
import { parseProjectSource } from '@8f4e/compiler';
import { afterEach, describe, expect, it } from 'vitest';
import initState, { applyCodeBlockSourceEdits } from '../../../index';
import { EMPTY_DEFAULT_PROJECT } from '../emptyDefaultProject';

const cleanups: Array<() => void> = [];
afterEach(() => {
	while (cleanups.length) cleanups.pop()!();
});

function setup(modeToggling = true) {
	const emitter = new EventEmitter();
	const events = { on: emitter.on.bind(emitter), off: emitter.off.bind(emitter), dispatch: emitter.emit.bind(emitter) };
	const store = initState(events, { callbacks: {}, featureFlags: { modeToggling, codeLineSelection: false } });
	cleanups.push(store.dispose);
	const load = (source: string) => events.dispatch('loadProject', { project: parseProjectSource(source) });
	return { store, state: store.getState(), events, load };
}

describe('project initial mode', () => {
	it.each(['edit', 'view'] as const)('applies %s before publishing the loaded project', mode => {
		const { state, store, load } = setup();
		const notifications: unknown[] = [];
		store.subscribe('projectChange', () => {
			notifications.push([state.projectChange.kind, state.editorMode, state.featureFlags.editing]);
		});
		load(`8f4e/v1\nnote mode\n; @mode ${mode}\nnoteEnd`);
		expect(notifications).toEqual([['replace', mode, mode === 'edit']]);
		expect(state.featureFlags.codeLineSelection).toBe(true);
		expect(state.historyStack).toHaveLength(0);
	});

	it.each(['', '; @mode other', '; @mode edit\n; @mode view'])(
		'starts each replacement in view for %s',
		declaration => {
			const { state, events, load } = setup();
			load('8f4e/v1\nnote mode\n; @mode edit\nnoteEnd');
			expect(state.editorMode).toBe('edit');
			load(`8f4e/v1\nnote mode\n${declaration}\nnoteEnd`);
			expect(state.editorMode).toBe('view');
			expect(state.featureFlags.editing).toBe(false);
			expect(state.codeErrors.editorDirectiveErrors).toHaveLength(declaration ? 1 : 0);
			events.dispatch('enterEditMode');
			events.dispatch('new');
			expect(state.initialProjectState).toMatchObject({ ...EMPTY_DEFAULT_PROJECT, constants: expect.any(Array) });
			expect(state.editorMode).toBe('view');
		}
	);

	it('finds a directive in a nested project group even when mode toggling is disabled', () => {
		const { state, load } = setup(false);
		load('8f4e/v1\nentry main\ngroup child\nnote mode\n; @mode edit\nnoteEnd\ngroupEnd\nentryEnd');
		expect(state.editorMode).toBe('edit');
		expect(state.featureFlags.modeToggling).toBe(false);
	});

	it('keeps user mode changes through source edits, configuration updates, and undo/redo', () => {
		const { state, store, events, load } = setup();
		load('8f4e/v1\nnote mode\n; @mode edit\nnoteEnd');
		const revision = state.projectChange.revision;
		events.dispatch('exitToViewMode');
		expect(state.editorMode).toBe('view');
		expect(state.projectChange.revision).toBe(revision);
		const block = state.codeBlockRendering.rootCodeBlocks.find(block => block.blockType === 'note')!;
		applyCodeBlockSourceEdits(store, [{ codeBlock: block, code: ['note mode', '; @mode view', 'noteEnd'] }], {
			affectsCompilation: false,
		});
		store.set('editorConfigSchemaContributions', {});
		expect(state.globalEditorDirectives.mode).toBe('view');
		expect(state.editorMode).toBe('view');
		events.dispatch('undo');
		expect(state.globalEditorDirectives.mode).toBe('edit');
		expect(state.editorMode).toBe('view');
		events.dispatch('enterEditMode');
		events.dispatch('redo');
		expect(state.globalEditorDirectives.mode).toBe('view');
		expect(state.editorMode).toBe('edit');
	});
});
