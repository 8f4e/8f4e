import type { EventDispatcher, State } from '@8f4e/editor-state-types';
import type { ProjectObjectModel } from '@8f4e/language-spec';
import type { StateManager } from '@8f4e/state-manager';
import serializeToProject from '../../pureHelpers/projectSerialization/serializeToProject';
import { restoreProject } from '../project-changes';

/** Apply canonical API drafts independently of optional history tracking. */
export default function projectOperations(store: StateManager<State>, events: EventDispatcher): () => void {
	const applyProjectEdit = ({ project }: { project: ProjectObjectModel }) => {
		// Both models come from the canonical code-block serializer.
		if (JSON.stringify(project) === JSON.stringify(serializeToProject(store.getState()))) return;
		events.dispatch('beforeProjectEdit');
		restoreProject(store, project, 'checkpoint');
	};
	events.on('applyProjectEdit', applyProjectEdit);
	return () => events.off('applyProjectEdit', applyProjectEdit);
}
