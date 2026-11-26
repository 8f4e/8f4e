/**
 * Checks if a string uses the pointee element max function-style syntax: max(*name).
 *
 * @param name - Name to inspect.
 * @returns Whether the pointee element max prefix condition is true.
 */
export default function hasPointeeElementMaxPrefix(name: string): boolean {
	return name.startsWith('max(*') && name.endsWith(')');
}
