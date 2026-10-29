import { describe, expect, it } from 'vitest';
import extractPublicBlockFromModuleSource from './extractPublicBlockFromModuleSource';

describe('extractPublicBlockFromModuleSource', () => {
	it('returns the public block from module files', () => {
		expect(
			extractPublicBlockFromModuleSource('8f4e/v1\n\nentry main\nmodule foo\n; @public\nmoduleEnd\nentryEnd')
		).toEqual(['module foo', 'moduleEnd']);
	});

	it('returns the public non-test block from module files that include test entries', () => {
		const text = [
			'8f4e/v1',
			'',
			'function helper',
			'; @public',
			'functionEnd',
			'',
			'entry test',
			'module helperTest',
			'; @public',
			'push 1',
			'push 1',
			'call assert',
			'moduleEnd',
			'entryEnd',
		].join('\n');

		expect(extractPublicBlockFromModuleSource(text)).toEqual(['function helper', 'functionEnd']);
	});
});
