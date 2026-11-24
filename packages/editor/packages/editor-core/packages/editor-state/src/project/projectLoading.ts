import type { EventDispatcher } from '@8f4e/editor-state-types';
import type { ProjectObjectModel } from '@8f4e/language-spec';
import type { ProjectTransactionService } from './transactions';

export default function registerProjectLoading(
	projectTransactions: Pick<ProjectTransactionService, 'load'>,
	events: EventDispatcher
): () => void {
	const onLoad = ({ project }: { project: ProjectObjectModel }) => {
		projectTransactions.load(project);
	};
	events.on('loadProject', onLoad);
	return () => {
		events.off('loadProject', onLoad);
	};
}
