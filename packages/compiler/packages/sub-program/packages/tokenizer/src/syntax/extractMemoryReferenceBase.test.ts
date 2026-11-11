import { describe, expect, it } from 'vitest';
import extractMemoryReferenceBase from './extractMemoryReferenceBase';

describe('extractMemoryReferenceBase', () => {
	it('removes only the leading address operator', () => expect(extractMemoryReferenceBase('&value')).toBe('value'));
	it.each(['value', 'end(value)'])('leaves %s intact', value => expect(extractMemoryReferenceBase(value)).toBe(value));
});
