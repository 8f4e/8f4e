import type { SourceDiagnostic } from '@8f4e/language-spec';
import { describe, expect, it } from 'vitest';
import { CompilerError, serializeDiagnostic, withAsyncCompilerStage, withCompilerStage } from './compilerError';

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
	it('adds a detached known location to a transported internal diagnostic', () => {
		const original = serializeDiagnostic(new Error('Loading failed'), 'include fetch');
		const error = new CompilerError(original);
		const location = { ...diagnostic.location };
		const snapshot = serializeDiagnostic(error, 'outer', location);
		location.lineNumber = 99;
		expect(snapshot).toEqual({ ...original, location: diagnostic.location });
		expect(error.diagnostic).toEqual(original);
	});

	describe.each([
		{ name: 'synchronous', boundary: withCompilerStage },
		{ name: 'asynchronous', boundary: withAsyncCompilerStage },
	])('$name stage boundaries', ({ boundary }) => {
		it('adds a missing location while preserving the original failure details and cause', async () => {
			const original = serializeDiagnostic(new Error('Loading failed'), 'include fetch');
			const error = new CompilerError(original);
			await expect(async () =>
				boundary(
					'include loading',
					() => {
						throw error;
					},
					diagnostic.location
				)
			).rejects.toMatchObject({
				cause: error,
				diagnostic: { ...original, location: diagnostic.location },
			});
			expect(error.diagnostic).toEqual(original);
		});

		it.each([diagnostic, serializeDiagnostic(new Error('Located failure'), 'inner', diagnostic.location)])(
			'preserves an already located $kind error',
			async locatedDiagnostic => {
				const error = new CompilerError(locatedDiagnostic);
				expect(serializeDiagnostic(error, 'outer', { kind: 'document', lineNumber: 10 })).toEqual(locatedDiagnostic);
				await expect(async () =>
					boundary(
						'outer',
						() => {
							throw error;
						},
						{ kind: 'document', lineNumber: 10 }
					)
				).rejects.toBe(error);
			}
		);
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
