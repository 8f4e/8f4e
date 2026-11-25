import isPlainObject from './isPlainObject';

/**
 * Performs a deep equality check on two values.
 * Handles primitives, arrays, and plain objects.
 * Compares null/undefined correctly.
 */
export default function deepEqual(a: unknown, b: unknown): boolean {
	if (a === b) {
		return true;
	}

	if (a === null || b === null || a === undefined || b === undefined) {
		return a === b;
	}

	if (Array.isArray(a) && Array.isArray(b)) {
		if (a.length !== b.length) {
			return false;
		}
		for (let i = 0; i < a.length; i++) {
			if (!deepEqual(a[i], b[i])) {
				return false;
			}
		}
		return true;
	}

	if (isPlainObject(a) && isPlainObject(b)) {
		const keysA = Object.keys(a);
		const keysB = Object.keys(b);

		if (keysA.length !== keysB.length) {
			return false;
		}

		for (const key of keysA) {
			if (!Object.hasOwn(b, key)) {
				return false;
			}
			if (!deepEqual(a[key], b[key])) {
				return false;
			}
		}

		return true;
	}

	return false;
}
