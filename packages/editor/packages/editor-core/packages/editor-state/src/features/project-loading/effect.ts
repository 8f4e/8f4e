import type { EventDispatcher } from '@8f4e/editor-state-types';
import type { ProjectObjectModel } from '@8f4e/language-spec';
import type { ProjectEditService } from '../project-edits/service';
import { EMPTY_DEFAULT_PROJECT } from './emptyDefaultProject';

export default function projectLoading(
	projectEdits: Pick<ProjectEditService, 'restore'>,
	events: EventDispatcher
): void {
	events.on('loadProject', ({ project }: { project: ProjectObjectModel }) => {
		projectEdits.restore(project, 'replace');
	});
	events.on('new', () => events.dispatch('loadProject', { project: EMPTY_DEFAULT_PROJECT }));
}
