/**
 * Checks if a string matches the inter-modular element min reference pattern.
 * Valid pattern:
 * - min(module:memory) (element min reference)
 *
 * Enforces exactly one colon separator inside the parentheses.
 * Rejects extra separators/forms (e.g., min(module:path:to:memory)).
 * Rejects patterns with spaces.
 *
 * @param value - Value to inspect.
 * @returns Whether the intermodular element min reference condition is true.
 */
export default function isIntermodularElementMinReference(value: string): boolean {
	// Match min(<module>:<memory>)
	// Module and memory names cannot contain spaces, colons, or parentheses
	return /^min\([^\s:()]+:[^\s:()]+\)$/.test(value);
}
