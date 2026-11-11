import { describe, expect, it } from 'vitest';
import extractIntermodularModuleReferenceBase from './extractIntermodularModuleReferenceBase';

describe('extractIntermodularModuleReferenceBase', () => {
	it.each(['module', 'sourceModule'])('extracts %s from its leading address reference', module =>
		expect(extractIntermodularModuleReferenceBase(`&${module}:`)).toEqual({ module })
	);
});
