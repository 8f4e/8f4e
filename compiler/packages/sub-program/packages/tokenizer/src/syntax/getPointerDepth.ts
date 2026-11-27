/**
 * Parses pointer depth from an instruction string (e.g., "int**" returns 2).
 *
 * @param instruction - Instruction name to inspect.
 * @returns Resolved pointer depth.
 */
export default function getPointerDepth(instruction: string): number {
	const matches = instruction.match(/\*+$/);
	return matches ? matches[0].length : 0;
}
