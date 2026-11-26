/**
 * Checks if a string uses the element min function-style syntax: min(name).
 *
 * @param name - Name to inspect.
 * @returns Whether the element min prefix condition is true.
 */
export default function hasElementMinPrefix(name: string): boolean {
	return name.startsWith('min(') && name.endsWith(')');
}
