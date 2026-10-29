import { parseDirectiveLineRecords, serializeDirectiveComments } from '../directives/utils';

/**
 * Removes every matching directive, preserving source and other directives on the same line.
 *
 * @param code - Array of code lines
 * @param name - Name of the directive to remove (e.g., 'group', 'watch')
 * @returns New array with directive lines removed
 *
 * @example
 * ```typescript
 * const code = ['module test', '; @group myGroup', '; @favorite', 'moduleEnd'];
 * const filtered = removeDirective(code, 'group');
 * // Returns: ['module test', '; @favorite', 'moduleEnd']
 * ```
 */
export function removeDirective(code: string[], name: string): string[] {
	return code.flatMap(line => {
		const directives = parseDirectiveLineRecords(line);
		if (directives.length === 0) {
			return [line];
		}

		const remaining = directives.filter(directive => directive.name !== name);
		if (remaining.length === directives.length) {
			return [line];
		}

		const serialized = serializeDirectiveComments(remaining);
		if (directives[0].isTrailing) {
			const source = line.slice(0, line.indexOf(';'));
			return [serialized ? source + serialized : source.trimEnd()];
		}
		return serialized ? [serialized] : [];
	});
}
