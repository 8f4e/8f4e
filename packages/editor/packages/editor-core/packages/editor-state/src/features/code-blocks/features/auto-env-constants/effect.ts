import type { CodeBlockGraphicData, State } from '@8f4e/editor-state-types';
import type { ProjectBlock } from '@8f4e/language-spec';
import type { StateManager } from '@8f4e/state-manager';
import incrementCompilerInputRevision from '../../../program-compiler/incrementCompilerInputRevision';
import { getSelectedRuntimeEntry } from '../../../runtime/editorConfig';
import parsePos from '../directives/pos/data';

const AUTO_ENV_CONSTANTS_BLOCK_NAME = 'env';

const isEnvBlock = (block: CodeBlockGraphicData): boolean => block.name === AUTO_ENV_CONSTANTS_BLOCK_NAME;

/**
 * Generates the content for the auto-managed environment constants block.
 * This block provides runtime environment values as constants that can be used throughout the program.
 *
 * @param state - The current editor state
 * @param existingPos - Existing env block grid position from its `; @pos x y` directive. When provided, this
 * position is preserved in the regenerated block; otherwise the block defaults to `0,0`.
 * @returns Array of code lines for the constants block
 */
function generateEnvConstantsBlock(state: State, existingPos?: { x: number; y: number }): string[] {
	const lines: string[] = [];
	const pos = existingPos ?? { x: 0, y: 0 };

	// Header with warning
	lines.push(`constants ${AUTO_ENV_CONSTANTS_BLOCK_NAME}`);
	lines.push(`; @pos ${pos.x} ${pos.y}`);
	lines.push('; @favorite');
	lines.push('; Auto-generated environment constants');
	lines.push('; Changes will be overwritten');
	lines.push('');

	const runtimeEntry = getSelectedRuntimeEntry(state.editorConfig.runtime, state.runtimeRegistry);
	lines.push(...(runtimeEntry?.getEnvConstants?.(state.editorConfig) ?? []));

	for (const contribution of Object.values(state.envConstantContributions)) {
		if (contribution.length > 0) lines.push('', ...contribution);
	}

	lines.push('');
	lines.push('constantsEnd');

	return lines;
}

/**
 * Auto-managed environment constants block effect.
 *
 * This effect automatically maintains a constants block named 'env' that contains
 * environment values like contributed runtime values and contributed constants.
 * The env block is added to the project's constants collection when the project is loaded,
 * and its content is updated in codeBlockRendering.codeBlocks when contributed environment constants change.
 *
 * @param store - State manager instance
 */
export default function autoEnvConstants(store: StateManager<State>): void {
	function areCodeLinesEqual(a: string[], b: string[]): boolean {
		if (a.length !== b.length) {
			return false;
		}

		for (let i = 0; i < a.length; i++) {
			if (a[i] !== b[i]) {
				return false;
			}
		}

		return true;
	}

	/**
	 * Updates the env constants block code in codeBlockRendering.codeBlocks.
	 * This avoids triggering an infinite loop by not modifying initialProjectState.
	 */
	function updateEnvConstantsBlockInCodeBlockRendering(): void {
		const state = store.getState();
		const targetBlock = state.codeBlockRendering.codeBlocks.find(block => isEnvBlock(block));

		if (!targetBlock) {
			return;
		}
		const existingPos = parsePos(targetBlock.parsedDirectives);
		const newCode = generateEnvConstantsBlock(state, existingPos);

		if (areCodeLinesEqual(targetBlock.code, newCode)) {
			return;
		}

		targetBlock.code = newCode;
		targetBlock.lastUpdated = performance.now();

		store.set('codeBlockRendering.selectedCodeBlockForProgrammaticEdit', targetBlock);
		incrementCompilerInputRevision(store);
	}

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
				code: generateEnvConstantsBlock(state),
			};

			store.set('initialProjectState', {
				...state.initialProjectState,
				constants: [envBlock, ...state.initialProjectState.constants],
			});
		}
	}

	// Ensure env block exists when project is loaded
	store.subscribe('initialProjectState', ensureEnvBlockInProject);

	// Update env block code in codeBlockRendering.codeBlocks when editor config, runtime registry, change.
	// This avoids the infinite loop caused by modifying initialProjectState.
	store.subscribe('codeBlockRendering.selectedCodeBlock.code', updateEnvConstantsBlockInCodeBlockRendering);
	store.subscribe('codeBlockRendering.codeBlocks', updateEnvConstantsBlockInCodeBlockRendering);
	store.subscribe('editorConfig', updateEnvConstantsBlockInCodeBlockRendering);
	store.subscribe('runtimeRegistry', updateEnvConstantsBlockInCodeBlockRendering);
	store.subscribe('envConstantContributions', updateEnvConstantsBlockInCodeBlockRendering);
}
