/**
 * Extracts the base identifier from a memory pointer identifier by removing pointer prefixes.
 *
 * @param name - Name to inspect.
 * @returns Extracted memory pointer base.
 */
export default function extractMemoryPointerBase(name: string): string {
	return name.replace(/^\*+/, '');
}
