/**
 * Checks if a string has a memory pointer prefix (*).
 *
 * @param name - Name to inspect.
 * @returns Whether the memory pointer identifier condition is true.
 */
export default function isMemoryPointerIdentifier(name: string): boolean {
	return name.startsWith('*');
}
