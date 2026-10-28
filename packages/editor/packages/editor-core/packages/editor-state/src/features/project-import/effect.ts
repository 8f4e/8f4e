import type { EventDispatcher, State } from '@8f4e/editor-state-types';
import type { ProjectObjectModel } from '@8f4e/language-spec';
import type { StateManager } from '@8f4e/state-manager';
import { EMPTY_DEFAULT_PROJECT } from '~/features/project-import/emptyDefaultProject';
import { error, warn } from '../logger/logger';

export default function projectImport(store: StateManager<State>, events: EventDispatcher): void {
	const state = store.getState();

	function loadProject({
		project: newProject,
		preserveFileAssociation = false,
	}: {
		project: ProjectObjectModel;
		preserveFileAssociation?: boolean;
	}) {
		if (!preserveFileAssociation) {
			state.callbacks.projectLoaded?.(newProject);
		}
		store.set('initialProjectState', newProject);
	}

	function onImportProject() {
		if (!state.callbacks.importProject) {
			console.warn('No importProject callback provided');
			warn(state, 'No importProject callback provided');
			return;
		}

		state.callbacks
			.importProject()
			.then(project => {
				if (project) {
					loadProject({ project });
				}
			})
			.catch(err => {
				console.error('Failed to load project from file:', err);
				error(state, 'Failed to load project from file');
			});
	}

	events.on('new', () => loadProject({ project: EMPTY_DEFAULT_PROJECT }));
	events.on('importProject', onImportProject);
	events.on('loadProject', loadProject);
}
