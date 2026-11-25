/**
 * Extracts the module and memory identifiers from an inter-modular element word size reference.
 * Input: sizeof(module:memory)
 * Output: { module: 'module', memory: 'memory' }
 *
 * @param value - Value to inspect.
 * @returns Extracted intermodular element word size base.
 */
export default function extractIntermodularElementWordSizeBase(value: string): {
	module: string;
	memory: string;
} {
	// Remove leading "sizeof(" and trailing ")"
	const inner = value.slice(7, -1);
	const [module, memory] = inner.split(':');
	return { module, memory };
}
