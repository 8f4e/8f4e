import { describe, expect, it } from 'vitest';
import { isValidModuleName } from './moduleNames';

describe('isValidModuleName', () => {
	it.each(['audioOut', 'XORShift', 'voice_1', 'low-pass', '_internal', 'a', 'A1'])(
		'accepts the module name %s',
		moduleName => {
			expect(isValidModuleName(moduleName)).toBe(true);
		}
	);

	it.each([
		'',
		'1voice',
		'voice/left',
		'voice%left',
		'voice?left',
		'voice#left',
		'voice@left',
		'voice:left',
		'voice.left',
		'voice left',
		'vóice',
	])('rejects the module name %s', moduleName => {
		expect(isValidModuleName(moduleName)).toBe(false);
	});
});
