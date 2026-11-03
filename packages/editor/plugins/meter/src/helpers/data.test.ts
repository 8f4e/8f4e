import { describe, expect, it } from 'vitest';
import { createMeterDirectiveData } from './data';

describe('meter directive data', () => {
	it('accepts plain, address-of, and inferred typed value sources', () => {
		expect(createMeterDirectiveData(['level'], 2)).toEqual({ memoryId: 'level', lineNumber: 2 });
		expect(createMeterDirectiveData(['&buffer'], 3)).toEqual({ memoryId: '&buffer', lineNumber: 3 });
		expect(createMeterDirectiveData([], 4, 'float out ; @meter')).toEqual({ memoryId: 'out', lineNumber: 4 });
	});

	it('rejects debugger expressions and malformed ranges', () => {
		expect(createMeterDirectiveData(['*pointer'], 0)).toBeUndefined();
		expect(createMeterDirectiveData(['level', '0'], 0)).toBeUndefined();
		expect(createMeterDirectiveData(['level', 'invalid', '1'], 0)).toBeUndefined();
		expect(createMeterDirectiveData(['level', '0', '1', 'extra'], 0)).toBeUndefined();
	});
});
