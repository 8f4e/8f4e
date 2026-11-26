/**
 * Extracts the base identifier from a max() expression.
 * Input:  max(value)
 * Output: value
 *
 * @param name - Name to inspect.
 * @returns Extracted element max base.
 */
export default function extractElementMaxBase(name: string): string {
	if (name.startsWith('max(') && name.endsWith(')')) {
		return name.slice(4, -1);
	}
	return name;
}
