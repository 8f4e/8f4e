import type { SourceDiagnostic } from '@8f4e/language-spec';
import { describe, expect, it } from 'vitest';
import { CompilerError, serializeDiagnostic, withCompilerStage } from './compilerError';

const diagnostic: SourceDiagnostic = {
	kind: 'source',
	domain: 'semantic',
	code: 1,
	message: 'Unknown value',
	location: { kind: 'block', projectBlockId: 7, projectGroupPath: 'audio', lineNumber: 3 },
	instruction: 'push',
};

describe('compiler diagnostics', () => {
	it('preserves the complete diagnostic through serialization and returns detached snapshots', () => {
		const error = new CompilerError(diagnostic);
		expect(serializeDiagnostic(error, 'compile')).toEqual(diagnostic);
		const snapshot = serializeDiagnostic(error, 'compile');
		snapshot.message = 'changed';
		expect(error.diagnostic.message).toBe('Unknown value');
	});

	it('retains transported internal failures without inventing source positions', () => {
		const original = new Error('Unexpected failure');
		const serialized = serializeDiagnostic(original, 'memory planning');
		expect(serialized).toEqual({
			kind: 'internal',
			message: 'Unexpected failure',
			stage: 'memory planning',
			stack: original.stack,
		});
		expect(serializeDiagnostic(new CompilerError(serialized), 'worker')).toEqual(serialized);
		expect(serialized).not.toHaveProperty('location');
	});

	it('records the available location when an unexpected failure happens during a source operation', () => {
		expect(serializeDiagnostic('unexpected value', 'lowering', diagnostic.location)).toEqual({
			kind: 'internal',
			message: 'unexpected value',
			stage: 'lowering',
			location: diagnostic.location,
		});
	});
	it('keeps the original failing phase and cause through outer stage boundaries', () => {
		const cause = new Error('Broken invariant');
		try {
			withCompilerStage('outer', () =>
				withCompilerStage('memory planning', () => {
					throw cause;
				})
			);
			throw new Error('Expected stage failure');
		} catch (error) {
			expect(error).toBeInstanceOf(CompilerError);
			expect((error as Error).cause).toBe(cause);
			expect(serializeDiagnostic(error, 'transport')).toMatchObject({
				kind: 'internal',
				stage: 'memory planning',
				message: cause.message,
			});
		}
	});
});
