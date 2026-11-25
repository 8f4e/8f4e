import { IncludeErrorCode } from '@8f4e/language-spec';
import { expect, test } from 'vitest';

import { compileProject, parseProjectSource } from '../src';
import { getExportedFunction, instantiateFixtureProgramSource } from './testUtils';

test('binds stdlib dependencies independently from project functions and direct imports', async () => {
	const { instance } = await instantiateFixtureProgramSource(`8f4e/v1
includes
include std/math/fastSigmoid
include std/math/softsign
includesEnd
function softsign
param float value
push 0.0
functionEnd float
function libraryCall
#export
call fastSigmoid 3.0
functionEnd float
function projectCall
#export
call softsign 3.0
functionEnd float
`);
	expect(getExportedFunction(instance.exports, 'libraryCall')()).toBe(0.875);
	expect(getExportedFunction(instance.exports, 'projectCall')()).toBe(0);
});

test('keeps an indirect dependency out of project scope', async () => {
	await expect(
		instantiateFixtureProgramSource(`8f4e/v1
includes
include std/math/fastSigmoid
includesEnd
function projectCall
#export
call softsign 3.0
functionEnd float
`)
	).rejects.toThrow('Undefined function');
});

test('reports an undeclared call in a nested dependency at the original file and line', async () => {
	const project = parseProjectSource(`8f4e/v1
includes
include test/wrapper
includesEnd
function helper
push 42
functionEnd int
`);
	const sources = new Map([
		[
			'test/wrapper',
			`includes
include test/dependency
includesEnd

function wrapper
#export
call dependency
functionEnd int`,
		],
		[
			'test/dependency',
			`; A dependency cannot call a function defined only in the project.

function dependency
#export
call helper
functionEnd int`,
		],
	]);
	await expect(compileProject(project, { resolveInclude: id => sources.get(id) })).rejects.toMatchObject({
		diagnostic: {
			code: IncludeErrorCode.UNBOUND_CALL_TARGET,
			location: {
				kind: 'include-file',
				includeId: 'test/dependency',
				lineNumber: 4,
				includeSite: { projectBlockId: project.includes[0]!.id, projectGroupPath: '', lineNumber: 1 },
			},
		},
	});
});
