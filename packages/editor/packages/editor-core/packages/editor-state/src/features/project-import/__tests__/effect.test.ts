import type { State } from '@8f4e/editor-state-types';
import type { ProjectObjectModel } from '@8f4e/language-spec';
import createStateManager from '@8f4e/state-manager';
import { beforeEach, describe, expect, it, type MockInstance, vi } from 'vitest';
import { EMPTY_DEFAULT_PROJECT } from '~/features/project-import/emptyDefaultProject';
import { createMockState } from '~/pureHelpers/testingUtils/testUtils';
import { createMockEventDispatcherWithVitest } from '~/pureHelpers/testingUtils/vitestTestUtils';
import compiler from '../../program-compiler/effect';
import projectImport from '../effect';

describe('projectImport', () => {
	let mockState: State;
	let store: ReturnType<typeof createStateManager<State>>;
	let mockEvents: ReturnType<typeof createMockEventDispatcherWithVitest>;

	beforeEach(() => {
		mockState = createMockState();
		store = createStateManager(mockState);
		mockEvents = createMockEventDispatcherWithVitest();
	});

	describe('Event wiring', () => {
		it('should register importProject event handler', () => {
			projectImport(store, mockEvents);

			const onCalls = (mockEvents.on as unknown as MockInstance).mock.calls;
			const importProjectCall = onCalls.find(call => call[0] === 'importProject');
			expect(importProjectCall).toBeDefined();
		});

		it('should register loadProject event handler', () => {
			projectImport(store, mockEvents);

			const onCalls = (mockEvents.on as unknown as MockInstance).mock.calls;
			const loadProjectCall = onCalls.find(call => call[0] === 'loadProject');
			expect(loadProjectCall).toBeDefined();
		});
	});

	it('starts a new empty project and clears the previous file association', () => {
		mockState.callbacks.projectLoaded = vi.fn();
		projectImport(store, mockEvents);
		const handler = vi.mocked(mockEvents.on).mock.calls.find(call => call[0] === 'new')![1];
		handler(undefined);
		expect(mockState.initialProjectState).toEqual(EMPTY_DEFAULT_PROJECT);
		expect(mockState.callbacks.projectLoaded).toHaveBeenCalledWith(EMPTY_DEFAULT_PROJECT);
	});

	it('notifies the host for replacements, but preserves the file association for history', () => {
		mockState.callbacks.projectLoaded = vi.fn();
		projectImport(store, mockEvents);
		const handler = (mockEvents.on as unknown as MockInstance).mock.calls.find(call => call[0] === 'loadProject')![1];
		handler({ project: EMPTY_DEFAULT_PROJECT });
		expect(mockState.callbacks.projectLoaded).toHaveBeenCalledWith(EMPTY_DEFAULT_PROJECT);
		handler({ project: EMPTY_DEFAULT_PROJECT, preserveFileAssociation: true });
		expect(mockState.callbacks.projectLoaded).toHaveBeenCalledOnce();
	});

	it('leaves the project and file association unchanged after import cancellation', async () => {
		mockState.callbacks.importProject = vi.fn().mockResolvedValue(null);
		mockState.callbacks.projectLoaded = vi.fn();
		const original = mockState.initialProjectState;
		projectImport(store, mockEvents);
		const handler = (mockEvents.on as unknown as MockInstance).mock.calls.find(call => call[0] === 'importProject')![1];
		await handler();
		expect(mockState.initialProjectState).toBe(original);
		expect(mockState.callbacks.projectLoaded).not.toHaveBeenCalled();
	});

	describe('loadProject', () => {
		it('should load project without config reset plumbing', async () => {
			projectImport(store, mockEvents);
			compiler(store);

			const onCalls = (mockEvents.on as unknown as MockInstance).mock.calls;
			const loadProjectCall = onCalls.find(call => call[0] === 'loadProject');
			const loadProjectCallback = loadProjectCall![1];

			const project: ProjectObjectModel = {
				...EMPTY_DEFAULT_PROJECT,
			};

			loadProjectCallback({ project });

			expect(mockState.initialProjectState).toEqual(project);
		});

		it('should load new project without config state', async () => {
			projectImport(store, mockEvents);
			compiler(store);

			const onCalls = (mockEvents.on as unknown as MockInstance).mock.calls;
			const loadProjectCall = onCalls.find(call => call[0] === 'loadProject');
			const loadProjectCallback = loadProjectCall![1];

			const project: ProjectObjectModel = {
				...EMPTY_DEFAULT_PROJECT,
			};

			loadProjectCallback({ project });

			expect(mockState.initialProjectState).toEqual(project);
		});

		it('should store initial project state after loading', () => {
			projectImport(store, mockEvents);

			const onCalls = (mockEvents.on as unknown as MockInstance).mock.calls;
			const loadProjectCall = onCalls.find(call => call[0] === 'loadProject');
			const loadProjectCallback = loadProjectCall![1];

			loadProjectCallback({ project: EMPTY_DEFAULT_PROJECT });

			expect(mockState.initialProjectState).toEqual(EMPTY_DEFAULT_PROJECT);
		});
	});

	describe('importProject', () => {
		it('should trigger importProject callback when event is fired', async () => {
			const mockProject: ProjectObjectModel = {
				...EMPTY_DEFAULT_PROJECT,
			};

			mockState.callbacks.importProject = vi.fn().mockResolvedValue(mockProject);
			projectImport(store, mockEvents);

			const onCalls = (mockEvents.on as unknown as MockInstance).mock.calls;
			const importProjectCall = onCalls.find(call => call[0] === 'importProject');
			const importProjectCallback = importProjectCall![1];

			await importProjectCallback();

			expect(mockState.callbacks.importProject).toHaveBeenCalled();
		});

		it('should warn when no importProject callback is provided', () => {
			const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

			mockState.callbacks.importProject = undefined;
			projectImport(store, mockEvents);

			const onCalls = (mockEvents.on as unknown as MockInstance).mock.calls;
			const importProjectCall = onCalls.find(call => call[0] === 'importProject');
			const importProjectCallback = importProjectCall![1];

			importProjectCallback();

			expect(consoleWarnSpy).toHaveBeenCalledWith('No importProject callback provided');

			consoleWarnSpy.mockRestore();
		});

		it('should handle import errors gracefully', async () => {
			const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

			mockState.callbacks.importProject = vi.fn().mockRejectedValue(new Error('Import failed'));
			projectImport(store, mockEvents);

			const onCalls = (mockEvents.on as unknown as MockInstance).mock.calls;
			const importProjectCall = onCalls.find(call => call[0] === 'importProject');
			const importProjectCallback = importProjectCall![1];

			await importProjectCallback();

			// Need to wait for promise to settle
			await new Promise(resolve => setTimeout(resolve, 10));

			expect(consoleErrorSpy).toHaveBeenCalledWith('Failed to load project from file:', expect.any(Error));

			consoleErrorSpy.mockRestore();
		});
	});
});
