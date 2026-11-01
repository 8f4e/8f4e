import type { CodeBlockGraphicData, ContextMenuItem, State } from '@8f4e/editor-state-types';
import { documentBlockInstructionByType } from '@8f4e/language-spec';

const functionBlockType = documentBlockInstructionByType.function.type;
const noteBlockType = documentBlockInstructionByType.note.type;

export const moduleMenu = (
	state: State,
	codeBlock: CodeBlockGraphicData,
	items: readonly ContextMenuItem[]
): ContextMenuItem[] => {
	const blockType = codeBlock.blockType;
	const isProjectGroup = codeBlock.childProject !== undefined;
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
		...(state.codeBlockRendering.currentProject.blocks !== state.codeBlockRendering.rootProject.blocks
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
		...(state.editorMode === 'edit'
			? [
					{
						title: `Delete ${blockLabel}`,
						action: 'deleteCodeBlock',
						payload: { codeBlock },
						close: true,
					},
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
			title: `Copy ${blockLabel}`,
			action: 'copyCodeBlock',
			payload: { codeBlock },
			close: true,
			disabled: !state.callbacks.writeClipboardText,
		},
		{
			title: `Log ${blockLabel} info to console`,
			action: 'consoleLog',
			payload: { codeBlock },
			close: true,
		},
	];
};
