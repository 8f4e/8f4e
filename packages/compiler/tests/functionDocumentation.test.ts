import { createFunctionId } from '@8f4e/language-spec';
import { describe, expect, it } from 'vitest';
import { compileProject, parseProjectSource } from '../src';
import { resolveTestInclude } from './testIncludeResolver';

describe('compiled function documentation', () => {
	it('keeps documentation on the selected overload through includes, aliases, and group qualification', async () => {
		const project = parseProjectSource(`8f4e/v1
entry main
group voice
includes
include test/documented-overloads transform blend
includesEnd
entry main
module caller
call blend 1
drop
call blend 1.0
drop
moduleEnd
entryEnd
function blend
; @doc Local integer override.
; @param input The local input.
param int input
push input
functionEnd int
groupEnd
entryEnd`);
		const result = await compileProject(project, { resolveInclude: resolveTestInclude, includeStackAnalysis: true });
		const calls = result.compiledModules['voice/caller'].stackAnalysis!.filter(line => line.instruction === 'call');
		const functions = calls.map(line => result.compiledFunctions![line.resolvedCall!.targetFunctionId]);
		expect(functions.map(func => func.id)).toEqual([
			createFunctionId('voice/blend', ['int']),
			createFunctionId('voice/blend', ['float']),
		]);
		expect(functions[0].ast.documentation).toEqual({
			description: 'Local integer override.',
			parameters: { input: 'The local input.' },
		});
		expect(functions[1].ast.documentation).toEqual({
			description: 'Doubles a floating-point value.',
			parameters: { amount: 'The floating-point input. Supplied by the caller.' },
			returns: 'Twice the input.',
		});
	});

	it('updates only metadata when documentation changes', async () => {
		const source = `8f4e/v1
entry main
module caller
call f 1
drop
moduleEnd
entryEnd
function f
; @doc Old text.
param int input
push input
functionEnd int`;
		const initial = await compileProject(parseProjectSource(source), { includeStackAnalysis: true });
		const updated = await compileProject(parseProjectSource(source.replace('Old text.', 'New text.')), {
			cache: initial.cache,
			includeStackAnalysis: true,
		});
		const id = createFunctionId('f', ['int']);
		expect(updated.compiledFunctions![id].ast.documentation).toEqual({ description: 'New text.' });
		expect(initial.compiledFunctions![id].ast.documentation).toEqual({ description: 'Old text.' });
		expect(updated.codeBuffer).toEqual(initial.codeBuffer);
		expect(updated.compiledModules.caller.stackAnalysis).toEqual(initial.compiledModules.caller.stackAnalysis);
	});
});
