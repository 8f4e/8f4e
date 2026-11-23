import { createMockCodeBlock as createBaseMockCodeBlock } from '@8f4e/editor-state-testing';
import type { CodeBlockGraphicData } from '@8f4e/editor-state-types';
import getCodeBlockNameFromSource from '~/features/code-blocks/utils/getCodeBlockNameFromSource';
import { parseBlockDirectives } from '~/features/code-blocks/utils/parseBlockDirectives';
import { getTabStopsByLine } from '~/features/text-geometry/tabLayout';
import { updateProjectGroupMemoryExposureDeclarations } from '../projectGroupMemoryExposures';

/** Shared block defaults with editor-owned source-name and directive parsing. */
export function createMockCodeBlock(options: Parameters<typeof createBaseMockCodeBlock>[0] = {}): CodeBlockGraphicData {
	const code = options.code ?? [];
	const parsedDirectives = options.parsedDirectives ?? parseBlockDirectives(code);
	const block = createBaseMockCodeBlock({
		name: options.name ?? (getCodeBlockNameFromSource(code) || 'test-block'),
		parsedDirectives,
		tabStopsByLine: getTabStopsByLine(code.length, parsedDirectives),
		...options,
	});
	updateProjectGroupMemoryExposureDeclarations(block);
	return block;
}

export function setMockCodeBlockCode(codeBlock: CodeBlockGraphicData, code: string[]): void {
	codeBlock.code = code;
	codeBlock.parsedDirectives = parseBlockDirectives(code);
	codeBlock.tabStopsByLine = getTabStopsByLine(code.length, codeBlock.parsedDirectives);
}

export { createMockEventDispatcher, createMockState, createMockViewport } from '@8f4e/editor-state-testing';
