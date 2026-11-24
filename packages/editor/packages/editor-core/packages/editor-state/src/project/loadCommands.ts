import type { EventDispatcher } from '@8f4e/editor-state-types';
import type { ProjectObjectModel } from '@8f4e/language-spec';
import { EMPTY_DEFAULT_PROJECT } from './emptyDefaultProject';
import type { ProjectTransactionService } from './transactions';

export default function registerProjectLoadCommands(
	projectTransactions: Pick<ProjectTransactionService, 'load'>,
	events: EventDispatcher
): () => void {
	const onLoad = ({ project }: { project: ProjectObjectModel }) => {
		projectTransactions.load(project);
	};
	const onNew = () => events.dispatch('loadProject', { project: EMPTY_DEFAULT_PROJECT });
	events.on('loadProject', onLoad);
	events.on('new', onNew);
	return () => {
		events.off('loadProject', onLoad);
		events.off('new', onNew);
	};
}
