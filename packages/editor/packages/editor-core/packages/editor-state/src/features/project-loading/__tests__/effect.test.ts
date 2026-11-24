import { EventEmitter } from 'node:events';
import { describe, expect, it, vi } from 'vitest';
import initState, { serializeToProject } from '../../../index';
import { EMPTY_DEFAULT_PROJECT } from '../emptyDefaultProject';

describe('project loading', () => {
	it('loads explicit content and starts a new empty project through the same action', () => {
		const emitter = new EventEmitter();
		const events = {
			on: emitter.on.bind(emitter),
			off: emitter.off.bind(emitter),
			dispatch: emitter.emit.bind(emitter),
		};
		const store = initState(events, { callbacks: {} });
		const state = store.getState();
		const onLoad = vi.fn();
		events.on('loadProject', onLoad);
		const project = { ...EMPTY_DEFAULT_PROJECT, notes: [{ id: 0, code: ['note test', 'noteEnd'] }] };
		events.dispatch('loadProject', { project });
		expect(serializeToProject(state)).toMatchObject({
			...project,
			constants: [expect.objectContaining({ code: expect.arrayContaining(['constants env']) })],
		});
		expect(project.constants).toEqual([]);
		onLoad.mockClear();
		events.dispatch('new');
		expect(onLoad).toHaveBeenCalledWith({ project: EMPTY_DEFAULT_PROJECT });
		expect(serializeToProject(state).notes).toEqual([]);
		store.dispose();
	});
});
