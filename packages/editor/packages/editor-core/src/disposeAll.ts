/** Release every acquired resource, including when an earlier cleanup throws. */
export function disposeAll(cleanups: Array<() => void>): void {
	const errors: unknown[] = [];
	while (cleanups.length) {
		try {
			cleanups.pop()!();
		} catch (error) {
			errors.push(error);
		}
	}
	if (errors.length === 1) throw errors[0];
	if (errors.length > 1) throw new AggregateError(errors, 'Resource cleanup failed');
}
