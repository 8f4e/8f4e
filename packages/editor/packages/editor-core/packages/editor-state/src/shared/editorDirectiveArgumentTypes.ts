const DECIMAL_NUMBER_PATTERN = /^-?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i;

export function isMemoryId(value: string | undefined): value is string {
	if (!value || /[\s&*[\]()]/.test(value)) {
		return false;
	}

	const segments = value.split(':');
	return segments.length <= 2 && segments.every(segment => segment.length > 0);
}

export function isMemoryAddress(value: string | undefined): value is string {
	return Boolean(value?.startsWith('&') && isMemoryId(value.slice(1)));
}

/** Validates address sources, optionally allowing one explicit pointer dereference. */
export function isPointerSource(
	value: string | undefined,
	{ allowDereference = false }: { allowDereference?: boolean } = {}
): value is string {
	if (!value) {
		return false;
	}

	return (
		(allowDereference && value.startsWith('*') && isMemoryId(value.slice(1))) ||
		isMemoryAddress(value) ||
		isMemoryId(value)
	);
}

export function parseFiniteNumber(value: string | undefined): number | undefined {
	if (!value || !DECIMAL_NUMBER_PATTERN.test(value)) {
		return undefined;
	}

	const parsed = Number(value);
	return Number.isFinite(parsed) ? parsed : undefined;
}

export function parseInteger(value: string | undefined): number | undefined {
	if (!value || !/^-?\d+$/.test(value)) {
		return undefined;
	}

	const parsed = Number(value);
	return Number.isSafeInteger(parsed) ? parsed : undefined;
}

export function parseElementCount(value: string | undefined): string | number | undefined {
	const literal = parseInteger(value);
	if (literal !== undefined) {
		return literal > 0 ? literal : undefined;
	}

	const countedMemoryMatch = value?.match(/^count\(([^()]+)\)$/);
	if (countedMemoryMatch) {
		return isMemoryId(countedMemoryMatch[1]) ? value : undefined;
	}

	return isMemoryId(value) ? value : undefined;
}
