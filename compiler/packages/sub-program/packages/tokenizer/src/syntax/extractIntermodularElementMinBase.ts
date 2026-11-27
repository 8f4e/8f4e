/**
 * Extracts the module and memory identifiers from an inter-modular element min reference.
 * Example: "min(module:buffer)" -> { module: "module", memory: "buffer" }
 *
 * @param value - Value to inspect.
 * @returns Extracted intermodular element min base.
 */
export default function extractIntermodularElementMinBase(value: string): {
	module: string;
	memory: string;
} {
	// Remove leading "min(" and trailing ")"
	const inner = value.slice(4, -1);
	const [module, memory] = inner.split(':');
	return { module, memory };
}
