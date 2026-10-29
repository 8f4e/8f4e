export function isRenderableInfoValue(value: unknown): value is string | number | boolean {
	return typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean';
}

export function formatInfoValue(value: string | number | boolean): string {
	if (typeof value === 'string') {
		return value;
	}

	if (typeof value === 'boolean') {
		return String(value);
	}

	if (!Number.isFinite(value) || Number.isInteger(value)) {
		return String(value);
	}

	const roundedValue = Math.round(value * 10000) / 10000;
	return String(Object.is(roundedValue, -0) ? 0 : roundedValue);
}
