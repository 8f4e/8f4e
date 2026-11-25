function appendHashInput(hash: number, input: string): number {
	let nextHash = hash;
	for (let index = 0; index < input.length; index++) {
		nextHash ^= input.charCodeAt(index);
		nextHash = Math.imul(nextHash, 16777619);
	}
	return nextHash >>> 0;
}

/**
 * Checks hash source.
 *
 * @param code - Source lines to process.
 * @returns Whether the h source condition is true.
 */
export default function hashSource(code: string[]): number {
	let hash = 2166136261;
	hash = appendHashInput(hash, `${code.length}\0`);
	for (const line of code) {
		hash = appendHashInput(hash, `${line.length}\0${line}\0`);
	}

	return hash >>> 0;
}
