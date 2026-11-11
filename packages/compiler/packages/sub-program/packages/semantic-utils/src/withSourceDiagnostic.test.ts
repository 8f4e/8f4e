import { getError, serializeDiagnostic } from '@8f4e/compiler-diagnostics';
import { ErrorCode } from '@8f4e/language-spec';
import { describe, expect, it } from 'vitest';
import { withSourceDiagnostic } from './withSourceDiagnostic';

const source = {
	diagnosticSource: { kind: 'block', projectBlockId: 8, projectGroupPath: 'audio' },
	lineNumber: 4,
	instruction: 'assertEqual',
} as const;

describe('normalized instruction diagnostics', () => {
	it('keeps the original instruction while retaining a complete source location', () => {
		try {
			withSourceDiagnostic(source, 'semantic references', () => {
				throw getError(ErrorCode.UNDECLARED_IDENTIFIER, { ...source, instruction: 'push' });
			});
			throw new Error('Expected source failure');
		} catch (error) {
			expect(serializeDiagnostic(error, 'host')).toMatchObject({
				kind: 'source',
				instruction: 'assertEqual',
				location: { kind: 'block', projectBlockId: 8, projectGroupPath: 'audio', lineNumber: 4 },
			});
		}
	});
	it('attaches the known source operation to unexpected failures', () => {
		try {
			withSourceDiagnostic(source, 'stack analysis', () => {
				throw new Error('Broken invariant');
			});
			throw new Error('Expected internal failure');
		} catch (error) {
			expect(serializeDiagnostic(error, 'host')).toMatchObject({
				kind: 'internal',
				stage: 'stack analysis',
				location: { kind: 'block', projectBlockId: 8, projectGroupPath: 'audio', lineNumber: 4 },
			});
		}
	});
});
