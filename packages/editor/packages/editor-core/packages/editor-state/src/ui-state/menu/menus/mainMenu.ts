import type { ContextMenuItem, State } from '@8f4e/editor-state-types';

export const mainMenu = (state: State, contributions: ContextMenuItem[]): ContextMenuItem[] => {
	if (state.project.activeLevel === state.project.rootLevel) return contributions;

	const goBack = { title: 'Go back', action: 'goToParentProjectGroup', close: true };
	return contributions.length ? [goBack, { divider: true }, ...contributions] : [goBack];
};
