import { removeDirective, upsertDirective } from '../editing/index';

/**
 * Inserts or removes @disabled directive from code block lines.
 *
 * Rules:
 * - If disabled is true, ensures exactly one @disabled directive exists
 * - If disabled is false, removes all @disabled directives
 * - When inserting, places @disabled at the beginning (after first line if it's a block declaration)
 * - Idempotent: calling with same disabled value produces same result
 *
 * @param code - Array of code lines
 * @param disabled - Whether the block should be disabled
 * @returns New code array with @disabled directive inserted or removed
 *
 * @example
 * ```typescript
 * const code = ['module test', 'moduleEnd'];
 * const disabled = upsertDisabled(code, true);
 * // Result: ['module test', '; @disabled', 'moduleEnd']
 * const enabled = upsertDisabled(disabled, false);
 * // Result: ['module test', 'moduleEnd']
 * ```
 */
export default function upsertDisabled(code: string[], disabled: boolean): string[] {
	return disabled ? upsertDirective(code, 'disabled') : removeDirective(code, 'disabled');
}
