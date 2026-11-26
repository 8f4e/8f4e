/**
 * Extracts the module and memory identifiers from an inter-modular element max reference.
 * Example: "max(module:buffer)" -> { module: "module", memory: "buffer" }
 *
 * @param value - Value to inspect.
 * @returns Extracted intermodular element max base.
 */
export default function extractIntermodularElementMaxBase(value: string): {
	module: string;
	memory: string;
} {
	// Remove leading "max(" and trailing ")"
	const inner = value.slice(4, -1);
	const [module, memory] = inner.split(':');
	return { module, memory };
}
