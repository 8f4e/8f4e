import { readdirSync } from 'node:fs';
import { sep } from 'node:path';
import { createFunctionId } from '@8f4e/language-spec';
import { describe, expect, it } from 'vitest';
import { compileProject, parseProjectSource } from '../src';
import { resolveStdlibInclude } from './stdlibResolver';

describe('compiled function documentation', () => {
	it('keeps documentation on the selected overload through includes, aliases, and group qualification', async () => {
		const project = parseProjectSource(`8f4e/v1
entry main
group voice
includes
include std/math/lerp lerp blend
includesEnd
entry main
module caller
call blend 0.0 1.0 0.5
drop
call blend 0.0f64 1.0f64 0.5f64
drop
moduleEnd
entryEnd
function blend
; @doc Local single-precision override.
; @param start The local starting point.
param float start
param float end
param float amount
push start
functionEnd float
groupEnd
entryEnd`);
		const result = await compileProject(project, { resolveInclude: resolveStdlibInclude, includeStackAnalysis: true });
		const calls = result.compiledModules['voice/caller'].stackAnalysis!.filter(line => line.instruction === 'call');
		const functions = calls.map(line => result.compiledFunctions![line.resolvedCall!.targetFunctionId]);
		expect(functions.map(func => func.id)).toEqual([
			createFunctionId('voice/blend', ['float', 'float', 'float']),
			createFunctionId('voice/blend', ['float64', 'float64', 'float64']),
		]);
		expect(functions[0].ast.documentation).toEqual({
			description: 'Local single-precision override.',
			parameters: { start: 'The local starting point.' },
		});
		expect(functions[1].ast.documentation).toEqual({
			description: 'Linearly interpolates between two values.',
			parameters: {
				start: 'The starting value.',
				end: 'The target value.',
				amount: 'Interpolation factor (0..1; outside extrapolates).',
			},
			returns: 'The interpolated value.',
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

	it('ships documentation for every standard-library function and its parameters', async () => {
		const stdlibRoot = new URL('std/', import.meta.resolve('@8f4e/stdlib/package.json'));
		const includes = readdirSync(stdlibRoot, { recursive: true, encoding: 'utf8' })
			.filter(file => file.endsWith('.8f4e'))
			.sort()
			.map(file => `include std/${file.slice(0, -'.8f4e'.length).replaceAll(sep, '/')}`);
		expect(includes.length).toBeGreaterThan(0);
		const project = parseProjectSource(`8f4e/v1\nincludes\n${includes.join('\n')}\nincludesEnd`);
		const { compiledFunctions } = await compileProject(project, { resolveInclude: resolveStdlibInclude });
		const functions = Object.values(compiledFunctions!);
		expect(functions.length).toBeGreaterThan(0);
		for (const { id, ast, signature } of functions) {
			expect(ast.documentation?.description, id).toBeTruthy();
			for (const { name } of signature.parameters) {
				expect(ast.documentation?.parameters?.[name], `${id}: ${name}`).toBeTruthy();
			}
			if (signature.returns.length > 0) expect(ast.documentation?.returns, `${id}: return values`).toBeTruthy();
		}
	});
});
