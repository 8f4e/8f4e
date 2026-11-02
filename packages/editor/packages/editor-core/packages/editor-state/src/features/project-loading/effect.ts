import type { EventDispatcher, State } from '@8f4e/editor-state-types';
import type { ProjectObjectModel } from '@8f4e/language-spec';
import type { StateManager } from '@8f4e/state-manager';
import { restoreProject } from '../project-changes';
import { EMPTY_DEFAULT_PROJECT } from './emptyDefaultProject';

export default function projectLoading(store: StateManager<State>, events: EventDispatcher): void {
	events.on('loadProject', ({ project }: { project: ProjectObjectModel }) => {
		restoreProject(store, project, 'replace');
	});
	events.on('new', () => events.dispatch('loadProject', { project: EMPTY_DEFAULT_PROJECT }));
}
