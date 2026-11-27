import { describe, expect, it } from 'vitest';

import extractIntermodularElementCountBase from './extractIntermodularElementCountBase';

describe('extractIntermodularElementCountBase', () => {
	it('extracts module and memory from element count reference', () => {
		expect(extractIntermodularElementCountBase('count(module:buffer)')).toEqual({
			module: 'module',
			memory: 'buffer',
		});
		expect(extractIntermodularElementCountBase('count(sourceModule:data)')).toEqual({
			module: 'sourceModule',
			memory: 'data',
		});
	});
});
