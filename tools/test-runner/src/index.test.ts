import { getProjectModules } from '@8f4e/language-spec';
import { parseProjectSource } from '@8f4e/project-preparser';
import { describe, expect, it } from 'vitest';
import { hasTestEntry } from './index';

describe('hasTestEntry', () => {
	it('recognizes test modules in nested groups', () => {
		expect(
			hasTestEntry(
				parseProjectSource(`8f4e/v1
entry test
group outer
entry main
group inner
entry main
module testModule
moduleEnd
entryEnd
groupEnd
entryEnd
groupEnd
entryEnd`)
			)
		).toBe(true);
	});

	it('recognizes a root function exported as test, including comments', () => {
		expect(
			hasTestEntry(
				parseProjectSource(`8f4e/v1
function helper
#export test ; public entry
functionEnd`)
			)
		).toBe(true);
		expect(
			hasTestEntry(
				parseProjectSource(`8f4e/v1
function test
#export
functionEnd`)
			)
		).toBe(true);
	});

	it('preserves declared test entries even when their modules are disabled', () => {
		const project = parseProjectSource(`8f4e/v1
entry test
module disabledTest
moduleEnd
entryEnd
function test
#export
functionEnd`);
		getProjectModules(project)[0].disabled = true;
		project.functions[0].disabled = true;
		expect(hasTestEntry(project)).toBe(true);
		project.entries = [];
		expect(hasTestEntry(project)).toBe(false);
		expect(
			hasTestEntry(
				parseProjectSource(`8f4e/v1
function test
functionEnd`)
			)
		).toBe(false);
		expect(
			hasTestEntry(
				parseProjectSource(`8f4e/v1
entry main
group inner
function test
#export
functionEnd
entry main
entryEnd
groupEnd
entryEnd`)
			)
		).toBe(false);
	});
});
