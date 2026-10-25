import type { CodeBlockGraphicData, ContextMenuItem, State } from '@8f4e/editor-state-types';
import { documentBlockInstructionByType } from '@8f4e/language-spec';
import { isSkipExecutionDirective } from '@8f4e/tokenizer';
import { getGroupBlocks, getGroupModuleBlocks } from '../../code-blocks/features/group/getGroupBlocks';
import { hasIntermodularMemoryConnections } from '../../code-blocks/features/memoryConnectionRemover/removeConnections';

const functionBlockType = documentBlockInstructionByType.function.type;
const moduleBlockType = documentBlockInstructionByType.module.type;
const noteBlockType = documentBlockInstructionByType.note.type;

interface ModuleMenuContext {
	codeBlock?: CodeBlockGraphicData;
	items?: readonly ContextMenuItem[];
}

export const moduleMenu = (state: State, context: ModuleMenuContext = {}): ContextMenuItem[] => {
	const selectedCodeBlock = context.codeBlock ?? state.codeBlockRendering.selectedCodeBlock;
	const blockType = selectedCodeBlock?.blockType;
	const isProjectGroup = selectedCodeBlock?.nestedProjectCodeBlocks !== undefined;
	let blockLabel = 'module';

	if (isProjectGroup) {
		blockLabel = 'group';
	} else if (blockType === functionBlockType) {
		blockLabel = 'function';
	} else if (blockType === noteBlockType) {
		blockLabel = 'note';
	}

	const isDisabled = selectedCodeBlock?.disabled ?? false;

	// Check if code block has ; @favorite directive
	const hasFavoriteDirective = selectedCodeBlock?.isFavorite ?? false;
	const hasSliders = (selectedCodeBlock?.widgets.sliders.length ?? 0) > 0;
	const hasPianos = (selectedCodeBlock?.widgets.pianoKeyboards.length ?? 0) > 0;
	const hasMemoryConnections = selectedCodeBlock ? hasIntermodularMemoryConnections(selectedCodeBlock.code) : false;

	// Check if code block has a group name and compute group skip/nonstick status
	const groupName = selectedCodeBlock?.groupName;
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
						payload: { codeBlock: selectedCodeBlock },
						close: true,
					},
				]
			: []),
		...(state.featureFlags.editing
			? [
					{
						title: `Delete ${blockLabel}`,
						action: 'deleteCodeBlock',
						payload: { codeBlock: selectedCodeBlock },
						close: true,
					},
					{
						title: isDisabled ? `Enable ${blockLabel}` : `Disable ${blockLabel}`,
						action: 'toggleCodeBlockDisabled',
						payload: { codeBlock: selectedCodeBlock },
						close: true,
					},
				]
			: []),
		...(context.items ?? []),
		...(state.featureFlags.editing
			? [
					...(blockType === moduleBlockType && hasGroup
						? [
								{
									title: allGroupBlocksSkipped ? 'Unskip group' : 'Skip group',
									action: 'toggleGroupSkipExecutionDirective',
									payload: { codeBlock: selectedCodeBlock },
									close: true,
								},
							]
						: []),
					...(hasGroup
						? [
								{
									title: 'Align blocks in row',
									action: 'alignGroupBlocksInRow',
									payload: { codeBlock: selectedCodeBlock },
									close: true,
								},
								{
									title: 'Remove from group',
									action: 'removeFromGroupDirective',
									payload: { codeBlock: selectedCodeBlock },
									close: true,
								},
								{
									title: `Ungroup "${groupName}"`,
									action: 'ungroupByName',
									payload: { codeBlock: selectedCodeBlock },
									close: true,
								},
								{
									title: allGroupBlocksNonstick ? 'Make Group Sticky' : 'Make Group Nonstick',
									action: 'toggleGroupNonstick',
									payload: {
										codeBlock: selectedCodeBlock,
										makeNonstick: !allGroupBlocksNonstick,
									},
									close: true,
								},
								{
									title: 'Delete group',
									action: 'deleteGroup',
									payload: { codeBlock: selectedCodeBlock },
									close: true,
								},
							]
						: []),
					{
						title: hasFavoriteDirective ? 'Unfavorite' : 'Favorite',
						action: 'toggleFavoriteDirective',
						payload: { codeBlock: selectedCodeBlock },
						close: true,
					},
					{
						title: 'Save slider and piano values to code',
						action: 'saveSliderValuesToCode',
						payload: { codeBlock: selectedCodeBlock },
						close: true,
						disabled: !(hasSliders || hasPianos) || !state.callbacks.getWordFromMemory,
					},
					{
						title: 'Remove connections',
						action: 'removeConnections',
						payload: { codeBlock: selectedCodeBlock },
						close: true,
						disabled: !hasMemoryConnections,
					},
				]
			: []),
		{
			title: `Copy ${blockLabel}`,
			action: 'copyCodeBlock',
			payload: { codeBlock: selectedCodeBlock },
			close: true,
			disabled: !state.callbacks.writeClipboardText,
		},
		...(hasGroup
			? [
					{
						title: 'Copy group',
						action: 'copyGroupBlocks',
						payload: { codeBlock: selectedCodeBlock },
						close: true,
						disabled: !state.callbacks.writeClipboardText,
					},
				]
			: []),
		{
			title: `Log ${blockLabel} info to console`,
			action: 'consoleLog',
			payload: { codeBlock: selectedCodeBlock },
			close: true,
		},
	];
};
