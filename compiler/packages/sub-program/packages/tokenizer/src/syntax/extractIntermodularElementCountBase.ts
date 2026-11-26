/**
 * Extracts the module and memory identifiers from an inter-modular element count reference.
 * Input: count(module:memory)
 * Output: { module: 'module', memory: 'memory' }
 *
 * @param value - Value to inspect.
 * @returns Extracted intermodular element count base.
 */
export default function extractIntermodularElementCountBase(value: string): {
	module: string;
	memory: string;
} {
	// Remove leading "count(" and trailing ")"
	const inner = value.slice(6, -1);
	const [module, memory] = inner.split(':');
	return { module, memory };
}
