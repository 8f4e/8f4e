/**
 * Extracts the base identifier from a pointee sizeof() expression.
 * Input:  sizeof(*value)
 * Output: value
 *
 * @param name - Name to inspect.
 * @returns Extracted pointee element word size base.
 */
export default function extractPointeeElementWordSizeBase(name: string): string {
	if (name.startsWith('sizeof(*') && name.endsWith(')')) {
		return name.slice(8, -1);
	}
	return name;
}
