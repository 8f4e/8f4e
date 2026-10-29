import { EventEmitter } from 'node:events';
import { parseProjectSource } from '@8f4e/compiler';
import { expect, it } from 'vitest';
import initState, { serializeToProject } from '../../index';

it('refreshes late directive layout without changing source, selection, or project/compiler revisions', () => {
	const emitter = new EventEmitter();
	const events = { on: emitter.on.bind(emitter), off: emitter.off.bind(emitter), dispatch: emitter.emit.bind(emitter) };
	const store = initState(events, { callbacks: {}, runtimeRegistry: {}, initialEditorMode: 'edit' });
	try {
		events.dispatch('loadProject', {
			project: parseProjectSource('8f4e/v1\nentry main\nmodule audio\n; @customLayout\nmoduleEnd\nentryEnd'),
		});
		const state = store.getState();
		const block = state.codeBlockRendering.codeBlocks.find(block => block.name === 'audio')!;
		store.set('codeBlockRendering.selectedCodeBlock', block);
		const source = serializeToProject(state);
		const revision = state.projectChange.revision;
		const compilerRevision = state.compilerInputRevision;
		const height = block.height;
		const lastUpdated = block.lastUpdated;
		const unregister = store.directives.register({
			name: 'customLayout',
			apply: (directive, draft) => {
				draft.addVerticalSpaceAfterSourceLine({ sourceLineIndex: directive.sourceLineIndex, heightInRows: 3 });
			},
		});
		events.dispatch('refreshCodeBlockLayouts');
		expect(block.gaps.get(1)?.size).toBe(3);
		expect(block.height).toBe(height + 3 * state.viewport.hGrid);
		expect(serializeToProject(state)).toEqual(source);
		expect(state.codeBlockRendering.selectedCodeBlock).toBe(block);
		expect(block.lastUpdated).toBe(lastUpdated);
		expect(state.projectChange.revision).toBe(revision);
		expect(state.compilerInputRevision).toBe(compilerRevision);
		unregister();
		events.dispatch('refreshCodeBlockLayouts');
		expect(block.gaps.size).toBe(0);
		expect(block.height).toBe(height);
	} finally {
		store.dispose();
	}
});
