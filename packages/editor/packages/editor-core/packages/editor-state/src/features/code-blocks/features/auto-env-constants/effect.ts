import type { CodeBlockGraphicData, State } from '@8f4e/editor-state-types';
import type { ProjectBlock } from '@8f4e/language-spec';
import type { StateManager } from '@8f4e/state-manager';
import incrementCompilerInputRevision from '../../../program-compiler/incrementCompilerInputRevision';
import { publishProjectChange } from '../../../project-changes';

const AUTO_ENV_CONSTANTS_BLOCK_NAME = 'env';

const isEnvBlock = (block: CodeBlockGraphicData): boolean => block.name === AUTO_ENV_CONSTANTS_BLOCK_NAME;

/**
 * Generates the content for the auto-managed environment constants block.
 * This block provides runtime environment values as constants that can be used throughout the program.
 *
 * @param state - The current editor state
 * @param position - Grid position to write into the generated source.
 * @returns Array of code lines for the constants block
 */
function generateEnvConstantsBlock(state: State, position: { x: number; y: number }): string[] {
	const lines: string[] = [];

	// Header with warning
	lines.push(`constants ${AUTO_ENV_CONSTANTS_BLOCK_NAME}`);
	lines.push(`; @pos ${position.x} ${position.y}`);
	lines.push('; Auto-generated environment constants');
	lines.push('; Changes will be overwritten');
	lines.push('');

	const contributions = Object.values(state.envConstantContributions).filter(lines => lines.length > 0);
	for (const [index, contribution] of contributions.entries()) {
		if (index > 0) lines.push('');
		lines.push(...contribution);
	}

	lines.push('');
	lines.push('constantsEnd');

	return lines;
}

/** Regenerate environment source using the block position established by source metadata refresh. */
export function updateEnvConstantsBlock(store: StateManager<State>): void {
	const state = store.getState();
	const targetBlock = state.codeBlockRendering.codeBlocks.find(block => isEnvBlock(block));

	if (!targetBlock) {
		return;
	}
	const newCode = generateEnvConstantsBlock(state, { x: targetBlock.gridX, y: targetBlock.gridY });

	if (targetBlock.code.length === newCode.length && targetBlock.code.every((line, index) => line === newCode[index])) {
		return;
	}

	targetBlock.code = newCode;
	targetBlock.lastUpdated = performance.now();

	store.set('codeBlockRendering.selectedCodeBlockForProgrammaticEdit', targetBlock);
	incrementCompilerInputRevision(store);
	publishProjectChange(store);
}

/** Ensure environment source exists on load and refresh it when its contributions change. */
export default function autoEnvConstants(store: StateManager<State>): void {
	/**
	 * Ensures env block exists in project when loaded.
	 * This only runs once when the project is loaded.
	 */
	function ensureEnvBlockInProject(): void {
		const state = store.getState();

		if (!state.initialProjectState) {
			return;
		}

		// Check if env block already exists
		const hasEnvBlock = state.initialProjectState.constants.some(
			block => block.code.length > 0 && block.code[0].includes(`constants ${AUTO_ENV_CONSTANTS_BLOCK_NAME}`)
		);

		if (!hasEnvBlock) {
			// Add the generated block at the beginning of the hoisted constants collection.
			const allIds = [
				...state.initialProjectState.modules,
				...state.initialProjectState.functions,
				...state.initialProjectState.constants,
				...state.initialProjectState.prototypes,
				...state.initialProjectState.includes,
				...state.initialProjectState.notes,
				...state.initialProjectState.unknown,
			].map(block => block.id);
			const envBlock: ProjectBlock = {
				id: Math.max(-1, ...allIds) + 1,
				code: generateEnvConstantsBlock(state, { x: 0, y: 0 }),
			};

			store.set('initialProjectState', {
				...state.initialProjectState,
				constants: [envBlock, ...state.initialProjectState.constants],
			});
		}
	}

	// Ensure env block exists when project is loaded
	store.subscribe('initialProjectState', ensureEnvBlockInProject);

	// Update env block code in codeBlockRendering.codeBlocks when contributed environment constants change.
	// This avoids the infinite loop caused by modifying initialProjectState.
	store.subscribe('editorConfig', () => updateEnvConstantsBlock(store));
	store.subscribe('envConstantContributions', () => updateEnvConstantsBlock(store));
}
