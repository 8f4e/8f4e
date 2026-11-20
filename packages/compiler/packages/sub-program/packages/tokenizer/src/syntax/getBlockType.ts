import type { CompilableBlockType, CompilerSourceBlockType } from '@8f4e/language-spec';
import { compilableBlockTypes, compilerSourceBlockInstructionPairs } from '@8f4e/language-spec';

export type CodeBlockType = CompilerSourceBlockType | 'unknown';

const BLOCK_MARKERS: Array<{
	type: CompilerSourceBlockType;
	opener: RegExp;
	closer: RegExp;
}> = compilerSourceBlockInstructionPairs.map(({ type, start, end }) => ({
	type,
	opener: new RegExp(`^\\s*${start}(\\s|$)`),
	closer: new RegExp(`^\\s*${end}(\\s|$)`),
}));

/**
 * Detects whether a block of code represents a module, function, constants, or unknown block by scanning for marker pairs.
 * @param code - Code block represented as an array of lines.
 * @returns The inferred code block type.
 */
export function getBlockType(code: string[]): CodeBlockType {
	const markerMatches = BLOCK_MARKERS.map(({ type, opener, closer }) => ({
		type,
		hasOpener: code.some(line => opener.test(line)),
		hasCloser: code.some(line => closer.test(line)),
	}));
	const presentTypes = markerMatches.filter(({ hasOpener, hasCloser }) => hasOpener || hasCloser);

	if (presentTypes.length !== 1) {
		return 'unknown';
	}

	const [match] = presentTypes;
	return match.hasOpener && match.hasCloser ? match.type : 'unknown';
}

/**
 * Returns true if the given block type is accepted as a direct input to the compiler
 * (modules, functions, and constants).
 * Constants blocks are treated as modules by the compiler.
 * Accepts undefined for safe use with optional chaining.
 *
 * @param blockType - Compiler block type to inspect.
 * @returns Whether the compilable block type condition is true.
 */
export function isCompilableBlockType(blockType: string | undefined): blockType is CompilableBlockType {
	return blockType !== undefined && (compilableBlockTypes as readonly string[]).includes(blockType);
}
