export type DebouncedTrailing<T extends (...args: unknown[]) => void> = ((...args: Parameters<T>) => void) & {
	cancel: () => void;
};

type DelayMs = number | (() => number);

/**
 * Creates a trailing-edge debounce wrapper.
 */
export default function debounceTrailing<T extends (...args: unknown[]) => void>(
	fn: T,
	delayMs: DelayMs
): DebouncedTrailing<T> {
	let timeout: ReturnType<typeof setTimeout> | null = null;

	const debounced = (...args: Parameters<T>) => {
		if (timeout) {
			clearTimeout(timeout);
		}

		timeout = setTimeout(
			() => {
				timeout = null;
				fn(...args);
			},
			typeof delayMs === 'function' ? delayMs() : delayMs
		);
	};

	debounced.cancel = () => {
		if (!timeout) {
			return;
		}

		clearTimeout(timeout);
		timeout = null;
	};

	return debounced;
}
