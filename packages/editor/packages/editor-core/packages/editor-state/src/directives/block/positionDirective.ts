import type { EditorDirectiveDefinition, ParsedDirectiveRecord } from '@8f4e/editor-state-types';

export interface PositionDirectiveData {
	x: number;
	y: number;
}

function parseStrictInteger(value: string): number | undefined {
	const parsed = parseInt(value, 10);
	if (isNaN(parsed) || value !== parsed.toString()) {
		return undefined;
	}

	return parsed;
}

const positionDirectiveDefinition: EditorDirectiveDefinition = {
	name: 'pos',
};

export function parsePositionDirectiveRecord(directive: ParsedDirectiveRecord): PositionDirectiveData | undefined {
	if (directive.args.length !== 2) {
		return undefined;
	}

	const x = parseStrictInteger(directive.args[0]);
	const y = parseStrictInteger(directive.args[1]);
	if (x === undefined || y === undefined) {
		return undefined;
	}

	return { x, y };
}

/**
 * Parses ; @pos directive from code block lines.
 *
 * A code block position is defined by a line matching the pattern:
 * "; @pos <x> <y>"
 *
 * @param parsedDirectives - Parsed directive records for the code block
 * @returns Object with x and y grid coordinates if a valid @pos directive is found, undefined otherwise
 *
 * Rules:
 * - x and y must be strict integers (negative values allowed)
 * - If multiple @pos lines exist, returns undefined (treated as invalid)
 * - Malformed values (non-integers, floats) return undefined
 *
 * @example
 * ```typescript
 * const code = [
 *   'module myModule',
 *   '; @pos 10 20',
 *   'output out 1',
 *   'moduleEnd'
 * ];
 * const result = parsePositionDirective(parseBlockDirectives(code)); // { x: 10, y: 20 }
 * ```
 */
export default function parsePositionDirective(
	parsedDirectives: ParsedDirectiveRecord[]
): PositionDirectiveData | undefined {
	const directives = parsedDirectives.filter(
		directive => directive.prefix === '@' && directive.name === positionDirectiveDefinition.name
	);
	if (directives.length !== 1) {
		return undefined;
	}

	return parsePositionDirectiveRecord(directives[0]);
}
