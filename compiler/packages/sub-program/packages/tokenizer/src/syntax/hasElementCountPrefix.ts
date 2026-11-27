/**
 * Checks if a string uses the element count function-style syntax: count(name).
 *
 * @param name - Name to inspect.
 * @returns Whether the element count prefix condition is true.
 */
export default function hasElementCountPrefix(name: string): boolean {
	return name.startsWith('count(') && name.endsWith(')');
}
