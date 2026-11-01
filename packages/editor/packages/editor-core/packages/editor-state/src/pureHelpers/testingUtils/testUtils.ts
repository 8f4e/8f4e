import { createMockCodeBlock as createBaseMockCodeBlock } from '@8f4e/editor-state-testing';
import type { CodeBlockGraphicData, DirectiveDerivedState, DirectiveDeriveOptions } from '@8f4e/editor-state-types';
import { deriveDirectiveState } from '~/features/code-blocks/features/directives/registry';
import getCodeBlockNameFromSource from '~/features/code-blocks/utils/getCodeBlockNameFromSource';
import { parseBlockDirectives } from '~/features/code-blocks/utils/parseBlockDirectives';

/** Shared block defaults with editor-owned source-name and directive parsing. */
export function createMockCodeBlock(options: Parameters<typeof createBaseMockCodeBlock>[0] = {}): CodeBlockGraphicData {
	const code = options.code ?? [];
	return createBaseMockCodeBlock({
		name: options.name ?? (getCodeBlockNameFromSource(code) || 'test-block'),
		parsedDirectives: options.parsedDirectives ?? parseBlockDirectives(code),
		...options,
	});
}

export function setMockCodeBlockCode(codeBlock: CodeBlockGraphicData, code: string[]): void {
	codeBlock.code = code;
	codeBlock.parsedDirectives = parseBlockDirectives(code);
}

export function deriveDirectiveStateForMockCodeBlock(
	codeBlock: CodeBlockGraphicData,
	options?: DirectiveDeriveOptions
): DirectiveDerivedState {
	codeBlock.parsedDirectives = parseBlockDirectives(codeBlock.code);
	return deriveDirectiveState(codeBlock.code, codeBlock.parsedDirectives, options);
}

export function deriveDirectiveStateForCode(
	code: string[],
	options?: DirectiveDeriveOptions,
	overrides: Partial<CodeBlockGraphicData> = {}
): DirectiveDerivedState {
	return deriveDirectiveStateForMockCodeBlock(createMockCodeBlock({ code, ...overrides }), options);
}

/**
 * Helper to find an item by id in a widgets array
 * Useful for test assertions on array-based widgets
 *
 * @param array - The widgets array to search
 * @param id - The id to find
 * @returns The item with the matching id, or undefined if not found
 *
 * @example
 * const output = findWidgetById(widgets, 'output1');
 * expect(output).toBeDefined();
 */
export function findWidgetById<T extends { id: string }>(array: T[], id: string): T | undefined {
	return array.find(item => item.id === id);
}

export { createMockEventDispatcher, createMockState, createMockViewport } from '@8f4e/editor-state-testing';
