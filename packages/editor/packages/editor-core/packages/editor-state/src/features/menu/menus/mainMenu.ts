import type { ContextMenuItem, State } from '@8f4e/editor-state-types';

export const mainMenu = (state: State, contributions: ContextMenuItem[] = []): ContextMenuItem[] => {
	const sections: ContextMenuItem[][] = [
		state.codeBlockRendering.currentProject.blocks !== state.codeBlockRendering.rootProject.blocks
			? [{ title: 'Go back', action: 'goToParentProjectGroup', close: true }]
			: [],
		state.editorMode === 'edit' && state.featureFlags.projectCreation
			? [{ title: 'New Project', action: 'new', close: true }]
			: [],
		contributions,
	];
	return sections
		.filter(section => section.length)
		.flatMap((section, index) => (index ? [{ divider: true }, ...section] : section));
};
