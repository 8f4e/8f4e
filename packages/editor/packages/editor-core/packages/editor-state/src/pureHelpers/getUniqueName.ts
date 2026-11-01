/** Increment a trailing number, or append 1, until a name is available. */
export function getUniqueName(desiredName: string, existingNames: Set<string>): string {
	let name = desiredName;
	while (existingNames.has(name)) {
		const match = name.match(/^(.*?)(\d+)$/);
		name = match ? match[1] + (Number(match[2]) + 1) : name + '1';
	}
	return name;
}
