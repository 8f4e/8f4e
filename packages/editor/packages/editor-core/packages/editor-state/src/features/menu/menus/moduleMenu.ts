import type { CodeBlockGraphicData, ContextMenuItem, State } from '@8f4e/editor-state-types';
import { documentBlockInstructionByType } from '@8f4e/language-spec';
import { isSkipExecutionDirective } from '@8f4e/tokenizer';
import { getGroupBlocks, getGroupModuleBlocks } from '../../code-blocks/features/group/getGroupBlocks';
import { hasIntermodularMemoryConnections } from '../../code-blocks/features/memoryConnectionRemover/removeConnections';

const functionBlockType = documentBlockInstructionByType.function.type;
const moduleBlockType = documentBlockInstructionByType.module.type;
const noteBlockType = documentBlockInstructionByType.note.type;

export const moduleMenu = (
	state: State,
	codeBlock: CodeBlockGraphicData,
	items: readonly ContextMenuItem[]
): ContextMenuItem[] => {
	const blockType = codeBlock.blockType;
	const isProjectGroup = codeBlock.nestedProjectCodeBlocks !== undefined;
	let blockLabel = 'module';

	if (isProjectGroup) {
		blockLabel = 'group';
	} else if (blockType === functionBlockType) {
		blockLabel = 'function';
	} else if (blockType === noteBlockType) {
		blockLabel = 'note';
	}

	const isDisabled = codeBlock.disabled;

	// Check if code block has ; @favorite directive
	const hasFavoriteDirective = codeBlock.isFavorite;
	const hasSliders = codeBlock.widgets.sliders.length > 0;
	const hasPianos = codeBlock.widgets.pianoKeyboards.length > 0;
	const hasMemoryConnections = hasIntermodularMemoryConnections(codeBlock.code);

	// Check if code block has a group name and compute group skip/nonstick status
	const groupName = codeBlock.groupName;
	const hasGroup = !!groupName;
	let allGroupBlocksSkipped = false;
	let allGroupBlocksNonstick = false;

	if (hasGroup) {
		// Find all blocks in the same group for nonstick check
		const groupBlocks = getGroupBlocks(state.codeBlockRendering.codeBlocks, groupName);
		// Check if all group blocks have nonstick flag
		allGroupBlocksNonstick = groupBlocks.every((block: CodeBlockGraphicData) => block.groupNonstick);

		if (blockType === moduleBlockType) {
			// Find all module blocks in the same group
			const groupModuleBlocks = getGroupModuleBlocks(state.codeBlockRendering.codeBlocks, groupName);
			// Check if all group module blocks have #skipExecution directive
			allGroupBlocksSkipped = groupModuleBlocks.every((block: CodeBlockGraphicData) =>
				block.code.some((line: string) => isSkipExecutionDirective(line))
			);
		}
	}

	return [
		...(state.codeBlockRendering.codeBlocks !== state.codeBlockRendering.rootCodeBlocks
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
		...(state.featureFlags.editing
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
		...(state.featureFlags.editing
			? [
					...(blockType === moduleBlockType && hasGroup
						? [
								{
									title: allGroupBlocksSkipped ? 'Unskip group' : 'Skip group',
									action: 'toggleGroupSkipExecutionDirective',
									payload: { codeBlock },
									close: true,
								},
							]
						: []),
					...(hasGroup
						? [
								{
									title: 'Align blocks in row',
									action: 'alignGroupBlocksInRow',
									payload: { codeBlock },
									close: true,
								},
								{
									title: 'Remove from group',
									action: 'removeFromGroupDirective',
									payload: { codeBlock },
									close: true,
								},
								{
									title: `Ungroup "${groupName}"`,
									action: 'ungroupByName',
									payload: { codeBlock },
									close: true,
								},
								{
									title: allGroupBlocksNonstick ? 'Make Group Sticky' : 'Make Group Nonstick',
									action: 'toggleGroupNonstick',
									payload: {
										codeBlock: codeBlock,
										makeNonstick: !allGroupBlocksNonstick,
									},
									close: true,
								},
								{
									title: 'Delete group',
									action: 'deleteGroup',
									payload: { codeBlock },
									close: true,
								},
							]
						: []),
					{
						title: hasFavoriteDirective ? 'Unfavorite' : 'Favorite',
						action: 'toggleFavoriteDirective',
						payload: { codeBlock },
						close: true,
					},
					{
						title: 'Save slider and piano values to code',
						action: 'saveSliderValuesToCode',
						payload: { codeBlock },
						close: true,
						disabled: !(hasSliders || hasPianos) || !state.callbacks.getWordFromMemory,
					},
					{
						title: 'Remove connections',
						action: 'removeConnections',
						payload: { codeBlock },
						close: true,
						disabled: !hasMemoryConnections,
					},
				]
			: []),
		{
			title: `Copy ${blockLabel}`,
			action: 'copyCodeBlock',
			payload: { codeBlock },
			close: true,
			disabled: !state.callbacks.writeClipboardText,
		},
		...(hasGroup
			? [
					{
						title: 'Copy group',
						action: 'copyGroupBlocks',
						payload: { codeBlock },
						close: true,
						disabled: !state.callbacks.writeClipboardText,
					},
				]
			: []),
		{
			title: `Log ${blockLabel} info to console`,
			action: 'consoleLog',
			payload: { codeBlock },
			close: true,
		},
	];
};
