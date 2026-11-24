import type { ContextMenuItem, EditorCodeBlock, State } from '@8f4e/editor-state-types';
import { documentBlockInstructionByType } from '@8f4e/language-spec';

const functionBlockType = documentBlockInstructionByType.function.type;
const noteBlockType = documentBlockInstructionByType.note.type;

export const codeBlockMenu = (
	state: State,
	codeBlock: EditorCodeBlock,
	items: readonly ContextMenuItem[]
): ContextMenuItem[] => {
	const blockType = codeBlock.blockType;
	const isProjectGroup = codeBlock.childLevel !== undefined;
	let blockLabel = 'module';

	if (isProjectGroup) {
		blockLabel = 'group';
	} else if (blockType === functionBlockType) {
		blockLabel = 'function';
	} else if (blockType === noteBlockType) {
		blockLabel = 'note';
	}

	const isDisabled = codeBlock.disabled;

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
		...(state.editorMode === 'edit' && !codeBlock.readOnly
			? [
					{
						title: isDisabled ? `Enable ${blockLabel}` : `Disable ${blockLabel}`,
						action: 'toggleCodeBlockDisabled',
						payload: { codeBlock },
						close: true,
					},
				]
			: []),
		...items,
		{
			title: `Log ${blockLabel} info to console`,
			action: 'consoleLog',
			payload: { codeBlock },
			close: true,
		},
	];
};
