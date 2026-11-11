/**
 * Checks if a string has a memory reference start-address prefix (&name).
 *
 * @param name - Name to inspect.
 * @returns Whether the memory reference prefix condition is true.
 */
export default function hasMemoryReferencePrefix(name: string): boolean {
	return name.startsWith('&');
}
