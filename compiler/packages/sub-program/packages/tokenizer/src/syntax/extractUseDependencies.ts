import instructionParser from './instructionParser';

/**
 * Extracts dependency identifiers from `use` instructions in source code.
 * Keeps source order and deduplicates repeated entries.
 *
 * @param source - Source text to inspect.
 * @returns Extracted use dependencies.
 */
export default function extractUseDependencies(source: string): string[] {
	const dependencies: string[] = [];
	const seen = new Set<string>();

	for (const line of source.split(/\r?\n/)) {
		const [, instruction, argumentText = ''] = line.match(instructionParser) || [];
		const dependency = argumentText.trim().split(/\s+/)[0];
		if (instruction !== 'use' || !dependency || seen.has(dependency)) {
			continue;
		}

		seen.add(dependency);
		dependencies.push(dependency);
	}

	return dependencies;
}
