/**
 * Checks if a string uses the element word size function-style syntax: sizeof(name).
 * Does not match the pointee form sizeof(*name).
 *
 * @param name - Name to inspect.
 * @returns Whether the element word size prefix condition is true.
 */
export default function hasElementWordSizePrefix(name: string): boolean {
	return name.startsWith('sizeof(') && name.endsWith(')') && !name.startsWith('sizeof(*');
}
