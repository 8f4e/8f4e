/**
 * Extracts the base identifier from a sizeof() expression.
 * Input:  sizeof(value)
 * Output: value
 *
 * @param name - Name to inspect.
 * @returns Extracted element word size base.
 */
export default function extractElementWordSizeBase(name: string): string {
	if (name.startsWith('sizeof(') && name.endsWith(')')) {
		return name.slice(7, -1);
	}
	return name;
}
