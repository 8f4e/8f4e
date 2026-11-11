import { createMockState } from '@8f4e/editor-state-testing';
import { describe, expect, it } from 'vitest';
import { diagnosticToCodeError } from './diagnostic-presentation';

describe('diagnostic presentation', () => {
	it('targets the include declaration for file-level validation failures', () => {
		expect(
			diagnosticToCodeError(
				{
					kind: 'source',
					domain: 'syntax',
					code: 2,
					message: 'Too many arguments for #export.',
					location: {
						kind: 'include-file',
						includeId: 'std/test',
						lineNumber: 7,
						includeSite: { projectBlockId: 23, projectGroupPath: 'audio', lineNumber: 2 },
					},
				},
				createMockState()
			)
		).toEqual({
			codeBlockId: 23,
			lineNumber: 2,
			message: 'std/test:8: Too many arguments for #export.',
		});
	});

	it('retains the file and row when no project declaration is available', () => {
		expect(
			diagnosticToCodeError(
				{
					kind: 'source',
					domain: 'syntax',
					code: 2,
					message: 'Too many arguments for #export.',
					location: { kind: 'include-file', includeId: 'std/test', lineNumber: 7 },
				},
				createMockState()
			)
		).toEqual({ message: 'std/test:8: Too many arguments for #export.' });
	});

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
