/**
 * Checks if a string matches the inter-modular element word size reference pattern.
 * Valid pattern:
 * - sizeof(module:memory) (element word size reference)
 *
 * Enforces exactly one colon separator inside the parentheses.
 * Rejects extra separators/forms (e.g., sizeof(module:path:to:memory)).
 * Rejects patterns with spaces.
 *
 * @param value - Value to inspect.
 * @returns Whether the intermodular element word size reference condition is true.
 */
export default function isIntermodularElementWordSizeReference(value: string): boolean {
	// Match sizeof(<module>:<memory>)
	// Module and memory names cannot contain spaces, colons, or parentheses
	return /^sizeof\([^\s:()]+:[^\s:()]+\)$/.test(value);
}
