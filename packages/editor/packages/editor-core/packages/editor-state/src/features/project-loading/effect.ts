import type { EventDispatcher } from '@8f4e/editor-state-types';
import type { ProjectObjectModel } from '@8f4e/language-spec';
import type { ProjectEditService } from '../project-edits/service';
import { EMPTY_DEFAULT_PROJECT } from './emptyDefaultProject';

export default function projectLoading(
	projectEdits: Pick<ProjectEditService, 'load'>,
	events: EventDispatcher
): () => void {
	const onLoad = ({ project }: { project: ProjectObjectModel }) => {
		projectEdits.load(project);
	};
	const onNew = () => events.dispatch('loadProject', { project: EMPTY_DEFAULT_PROJECT });
	events.on('loadProject', onLoad);
	events.on('new', onNew);
	return () => {
		events.off('loadProject', onLoad);
		events.off('new', onNew);
	};
}
