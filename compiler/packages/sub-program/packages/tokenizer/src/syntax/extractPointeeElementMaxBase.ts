/**
 * Extracts the base identifier from a pointee max() expression.
 * Input:  max(*value)
 * Output: value
 *
 * @param name - Name to inspect.
 * @returns Extracted pointee element max base.
 */
export default function extractPointeeElementMaxBase(name: string): string {
	if (name.startsWith('max(*') && name.endsWith(')')) {
		return name.slice(5, -1);
	}
	return name;
}
