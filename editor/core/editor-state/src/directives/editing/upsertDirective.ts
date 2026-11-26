import { removeDirective } from './removeDirective';

/**
 * Upserts a canonical single-line directive into code block lines.
 *
 * Rules:
 * - Removes any existing directives with the given name
 * - Inserts the canonical directive after the first line (block declaration)
 * - Idempotent: calling with same arguments produces same result
 *
 * @param code - Array of code lines
 * @param name - Directive name (e.g., 'pos', 'disabled')
 * @param args - Optional arguments for the directive
 * @returns New code array with canonical directive
 *
 * @example
 * ```typescript
 * const code = ['module test', 'moduleEnd'];
 * const updated = upsertDirective(code, 'pos', ['10', '20']);
 * // Result: ['module test', '; @pos 10 20', 'moduleEnd']
 * ```
 */
export function upsertDirective(code: string[], name: string, args: string[] = []): string[] {
	const withoutDirective = removeDirective(code, name);

	const directive = args.length > 0 ? `; @${name} ${args.join(' ')}` : `; @${name}`;

	if (withoutDirective.length === 0) {
		return [directive];
	}

	return [withoutDirective[0], directive, ...withoutDirective.slice(1)];
}
