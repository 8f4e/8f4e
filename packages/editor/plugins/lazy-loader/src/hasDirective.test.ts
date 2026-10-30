import { parseBlockDirectives } from '@8f4e/editor-state';
import { describe, expect, it } from 'vitest';
import { hasConfig, hasDirective } from './hasDirective';

describe('cached directive signals', () => {
	it('matches config roots before plugin schemas are installed', () => {
		const directives = parseBlockDirectives([
			'; @config customSettings.enabled false',
			'; @config customSettingsExtra.enabled true',
			'; @config otherRoot',
		]);
		expect(hasConfig(directives, 'customSettings')).toBe(true);
		expect(hasConfig(directives, 'otherRoot')).toBe(true);
		expect(hasConfig(directives, 'custom')).toBe(false);
		expect(hasConfig(directives, 'missing')).toBe(false);
	});

	it('matches chained and trailing directives and ignores plain mentions or partial names', () => {
		expect(hasDirective(parseBlockDirectives(['; @other @custom 4']), 'custom')).toBe(true);
		expect(hasDirective(parseBlockDirectives(['int value 0 ; @custom']), 'custom')).toBe(true);
		expect(hasDirective(parseBlockDirectives(['; documentation mentions @custom', '; @customExtra']), 'custom')).toBe(
			false
		);
	});
});
