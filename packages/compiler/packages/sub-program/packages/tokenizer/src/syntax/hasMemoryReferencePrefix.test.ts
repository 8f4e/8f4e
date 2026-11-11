import { describe, expect, it } from 'vitest';
import hasMemoryReferencePrefix from './hasMemoryReferencePrefix';

describe('start-address prefix', () => {
	it.each(['&value', '&module:value', '&module:'])('recognizes %s', value =>
		expect(hasMemoryReferencePrefix(value)).toBe(true)
	);
	it.each(['value', 'value&', 'end(value)'])('does not recognize %s as a prefix', value =>
		expect(hasMemoryReferencePrefix(value)).toBe(false)
	);
});
