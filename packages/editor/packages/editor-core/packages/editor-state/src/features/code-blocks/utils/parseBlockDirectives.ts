import type { ParsedDirectiveRecord } from '@8f4e/editor-state-types';
import { parseDirectiveRecords } from '../features/directives/utils';

/**
 * Scans every line of a code block's raw source and returns a flat array of
 * parsed editor directive records (`; @name`) from directive comments.
 *
 * One record is emitted per matching directive in source line order.
 */
export function parseBlockDirectives(code: string[]): ParsedDirectiveRecord[] {
	return parseDirectiveRecords(code);
}
