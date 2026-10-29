import { parseProjectSource } from '@8f4e/compiler';
import { EMPTY_DEFAULT_PROJECT } from '@8f4e/editor-state';
import type { ProjectObjectModel } from '@8f4e/language-spec';
import { describe, expect, it } from 'vitest';
import { hasDirective } from './hasDirective';

describe('project directive signals', () => {
	it.each(['modules', 'functions', 'constants', 'prototypes', 'includes', 'notes', 'unknown'] as const)(
		'scans %s source without requiring an installed directive',
		kind => {
			const project: ProjectObjectModel = { ...EMPTY_DEFAULT_PROJECT, [kind]: [{ id: 0, code: ['; @custom'] }] };
			expect(hasDirective(project, 'custom')).toBe(true);
		}
	);

	it('scans project-scope source and every nested group', () => {
		const project = parseProjectSource(`8f4e/v1
entry main
group outer
group inner
module audio
; @custom
moduleEnd
groupEnd
groupEnd
entryEnd`);
		expect(hasDirective(project, 'custom')).toBe(true);
		expect(hasDirective({ ...EMPTY_DEFAULT_PROJECT, code: ['; @custom'] }, 'custom')).toBe(true);
	});

	it('uses generic parsing for chained and trailing directives and ignores plain mentions or partial names', () => {
		const project = (code: string[]) => ({ ...EMPTY_DEFAULT_PROJECT, code });
		expect(hasDirective(project(['; @other @custom 4']), 'custom')).toBe(true);
		expect(hasDirective(project(['int value 0 ; @custom']), 'custom')).toBe(true);
		expect(hasDirective(project(['; documentation mentions @custom', '; @customExtra']), 'custom')).toBe(false);
	});
});
