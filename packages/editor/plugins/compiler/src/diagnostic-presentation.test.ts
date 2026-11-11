import { createMockState } from '@8f4e/editor-state-testing';
import { describe, expect, it } from 'vitest';
import { diagnosticToCodeError } from './diagnostic-presentation';

describe('diagnostic presentation', () => {
	it('targets an include declaration while retaining the included source in the message', () => {
		expect(
			diagnosticToCodeError(
				{
					kind: 'source',
					domain: 'semantic',
					code: 1,
					message: 'Unknown value',
					location: {
						kind: 'include',
						includeId: 'std/test',
						symbolName: 'helper',
						projectGroupPath: 'audio',
						lineNumber: 7,
						includeSite: { projectBlockId: 23, lineNumber: 2 },
					},
				},
				createMockState()
			)
		).toEqual({ codeBlockId: 23, lineNumber: 2, message: 'std/test (helper): Unknown value' });
	});
	it('keeps unexpected failures visible without inventing a source target', () => {
		expect(
			diagnosticToCodeError({ kind: 'internal', message: 'Worker failed', stage: 'compilation' }, createMockState())
		).toEqual({ message: 'Internal compiler error (compilation): Worker failed' });
	});
});
