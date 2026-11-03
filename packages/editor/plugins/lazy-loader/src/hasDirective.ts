import type { ParsedDirectiveRecord } from '@8f4e/editor-core';

/** Match cached directive records without loading their implementations. */
export function hasDirective(directives: readonly ParsedDirectiveRecord[], name: string): boolean {
	return directives.some(directive => directive.name === name);
}

/** Match a config root without requiring its lazy plugin's schema to be installed. */
export function hasConfig(directives: readonly ParsedDirectiveRecord[], root: string): boolean {
	return directives.some(
		directive =>
			directive.name === 'config' && (directive.args[0] === root || directive.args[0]?.startsWith(`${root}.`) === true)
	);
}
