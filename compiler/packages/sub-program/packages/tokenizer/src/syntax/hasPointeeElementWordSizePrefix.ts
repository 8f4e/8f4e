/**
 * Checks if a string uses the pointee element word size function-style syntax: sizeof(*name).
 *
 * @param name - Name to inspect.
 * @returns Whether the pointee element word size prefix condition is true.
 */
export default function hasPointeeElementWordSizePrefix(name: string): boolean {
	return name.startsWith('sizeof(*') && name.endsWith(')');
}
