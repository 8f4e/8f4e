import { describe, expect, it } from 'vitest';

import extractIntermodularElementWordSizeBase from './extractIntermodularElementWordSizeBase';

describe('extractIntermodularElementWordSizeBase', () => {
	it('extracts module and memory from element word size reference', () => {
		expect(extractIntermodularElementWordSizeBase('sizeof(module:buffer)')).toEqual({
			module: 'module',
			memory: 'buffer',
		});
		expect(extractIntermodularElementWordSizeBase('sizeof(sourceModule:data)')).toEqual({
			module: 'sourceModule',
			memory: 'data',
		});
	});
});
