export function tokenizeSelector(selector: string): string[] {
	return String(selector).split('.');
}
