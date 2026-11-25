/**
 * Checks if a string matches the inter-modular element max reference pattern.
 * Valid pattern:
 * - max(module:memory) (element max reference)
 *
 * Enforces exactly one colon separator inside the parentheses.
 * Rejects extra separators/forms (e.g., max(module:path:to:memory)).
 * Rejects patterns with spaces.
 *
 * @param value - Value to inspect.
 * @returns Whether the intermodular element max reference condition is true.
 */
export default function isIntermodularElementMaxReference(value: string): boolean {
	// Match max(<module>:<memory>)
	// Module and memory names cannot contain spaces, colons, or parentheses
	return /^max\([^\s:()]+:[^\s:()]+\)$/.test(value);
}
