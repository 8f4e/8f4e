import { upsertDirective } from '../editing/index';

/**
 * Upserts a canonical @pos directive into code block lines.
 *
 * Ensures exactly one @pos directive exists with the format:
 * "; @pos <gridX> <gridY>"
 *
 * Rules:
 * - Removes any existing @pos directives
 * - Inserts the canonical @pos directive at the beginning (after first line if it's a block declaration)
 * - Idempotent: calling with same coordinates produces same result
 *
 * @param code - Array of code lines
 * @param gridX - X grid coordinate
 * @param gridY - Y grid coordinate
 * @returns New code array with canonical @pos directive
 *
 * @example
 * ```typescript
 * const code = ['module test', 'moduleEnd'];
 * const updated = upsertPositionDirective(code, 10, 20);
 * // Result: ['module test', '; @pos 10 20', 'moduleEnd']
 * ```
 */
export default function upsertPositionDirective(code: string[], gridX: number, gridY: number): string[] {
	return upsertDirective(code, 'pos', [String(gridX), String(gridY)]);
}
