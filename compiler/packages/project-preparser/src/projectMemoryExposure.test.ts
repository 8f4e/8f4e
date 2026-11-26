import { describe, expect, it } from 'vitest';
import {
	parseProjectMemoryExposureLine,
	serializeProjectMemoryExposure,
	tryParseProjectMemoryExposureLine,
} from './projectMemoryExposure';

describe('project memory exposures', () => {
	it('parses and serializes a group-level memory exposure', () => {
		const exposure = parseProjectMemoryExposureLine('expose input &processor:input', 4);

		expect(exposure).toEqual({
			name: 'input',
			targetModuleName: 'processor',
			targetMemoryName: 'input',
		});
		expect(serializeProjectMemoryExposure(exposure)).toBe('expose input &processor:input');
	});

	it.each([
		'expose',
		'expose value',
		'expose value source:value',
		'expose value &source',
		'expose value &source:value extra',
		'expose 0 &source:value',
		'expose value &invalid/module:value',
		'expose value &source:0',
	])('rejects the malformed exposure %s', line => {
		expect(() => parseProjectMemoryExposureLine(line, 7)).toThrow('Parse error at line 7');
	});

	it('tolerates incomplete live-editor lines', () => {
		expect(tryParseProjectMemoryExposureLine('expose input')).toBeUndefined();
		expect(tryParseProjectMemoryExposureLine('module source')).toBeUndefined();
	});
});
