/**
 * Extracts the base identifier from a count() expression.
 * Input:  count(value)
 * Output: value
 *
 * @param name - Name to inspect.
 * @returns Extracted element count base.
 */
export default function extractElementCountBase(name: string): string {
	if (name.startsWith('count(') && name.endsWith(')')) {
		return name.slice(6, -1);
	}
	return name;
}
