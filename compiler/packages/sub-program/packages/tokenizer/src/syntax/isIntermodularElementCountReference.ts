/**
 * Checks if a string matches the inter-modular element count reference pattern.
 * Valid pattern:
 * - count(module:memory) (element count reference)
 *
 * Enforces exactly one colon separator inside the parentheses.
 * Rejects extra separators/forms (e.g., count(module:path:to:memory)).
 * Rejects patterns with spaces.
 *
 * @param value - Value to inspect.
 * @returns Whether the intermodular element count reference condition is true.
 */
export default function isIntermodularElementCountReference(value: string): boolean {
	// Match count(<module>:<memory>)
	// Module and memory names cannot contain spaces, colons, or parentheses
	return /^count\([^\s:()]+:[^\s:()]+\)$/.test(value);
}
