import { describe, expect, it } from 'vitest';

import extractIntermodularElementMinBase from './extractIntermodularElementMinBase';

describe('extractIntermodularElementMinBase', () => {
	it('extracts module and memory from inter-modular element min reference', () => {
		expect(extractIntermodularElementMinBase('min(module:buffer)')).toEqual({
			module: 'module',
			memory: 'buffer',
		});
		expect(extractIntermodularElementMinBase('min(sourceModule:data)')).toEqual({
			module: 'sourceModule',
			memory: 'data',
		});
	});
});
