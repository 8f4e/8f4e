import type { StackItem } from '@8f4e/language-spec';

function formatFloat32(value: number): string {
	const runtimeValue = Math.fround(value);
	if (!Number.isFinite(runtimeValue)) {
		return String(runtimeValue);
	}
	if (Object.is(runtimeValue, -0)) {
		return '-0';
	}

	for (let precision = 1; precision <= 9; precision++) {
		const candidate = Number(runtimeValue.toPrecision(precision));
		if (Object.is(Math.fround(candidate), runtimeValue)) {
			return String(candidate);
		}
	}

	return String(runtimeValue);
}

/** Formats a known stack value without exposing insignificant float32 representation noise. */
export function formatKnownStackValue(item: StackItem): string | undefined {
	if (item.knownValue === undefined) {
		return undefined;
	}

	return item.valueType === 'float' ? formatFloat32(item.knownValue) : String(item.knownValue);
}
