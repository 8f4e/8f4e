import type { ContextMenuItem, EditorCodeBlock, State } from '@8f4e/editor-state-types';

export const codeBlockMenu = (
	state: State,
	codeBlock: EditorCodeBlock,
	items: readonly ContextMenuItem[]
): ContextMenuItem[] => {
	const isProjectGroup = codeBlock.childLevel !== undefined;

	return [
		...(state.project.activeLevel !== state.project.rootLevel
			? [{ title: 'Go back', action: 'goToParentProjectGroup', close: true }]
			: []),
		...(isProjectGroup
			? [
					{
						title: 'Open group',
						action: 'openProjectGroup',
						payload: { codeBlock },
						close: true,
					},
				]
			: []),
		...items,
	];
};
