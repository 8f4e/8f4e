/**
 * Checks if a string uses the element max function-style syntax: max(name).
 * Does not match the pointee form max(*name).
 *
 * @param name - Name to inspect.
 * @returns Whether the element max prefix condition is true.
 */
export default function hasElementMaxPrefix(name: string): boolean {
	return name.startsWith('max(') && name.endsWith(')') && !name.startsWith('max(*');
}
