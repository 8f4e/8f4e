/** Extracts the identifier selected by the leading start-address operator. */
export default function extractMemoryReferenceBase(name: string): string {
	return name.startsWith('&') ? name.slice(1) : name;
}
