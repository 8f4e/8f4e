/** Extracts the module selected by a leading &module: start-address reference. */
export default function extractIntermodularModuleReferenceBase(value: string): { module: string } {
	return { module: value.slice(1, -1) };
}
