import { describe, expect, it } from 'vitest';

import extractIntermodularElementMaxBase from './extractIntermodularElementMaxBase';

describe('extractIntermodularElementMaxBase', () => {
	it('extracts module and memory from inter-modular element max reference', () => {
		expect(extractIntermodularElementMaxBase('max(module:buffer)')).toEqual({
			module: 'module',
			memory: 'buffer',
		});
		expect(extractIntermodularElementMaxBase('max(sourceModule:data)')).toEqual({
			module: 'sourceModule',
			memory: 'data',
		});
	});
});
