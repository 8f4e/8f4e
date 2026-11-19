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

test('requires a library file to declare dependencies even when the project defines the target', async () => {
	await expect(
		compileProject(
			parseProjectSource(`8f4e/v1
includes
include test/wrapper
includesEnd
function helper
push 42
functionEnd int
`),
			{
				resolveInclude: () => `function wrapper
#export
call helper
functionEnd int`,
			}
		)
	).rejects.toMatchObject({
		diagnostic: {
			code: IncludeErrorCode.UNBOUND_CALL_TARGET,
			location: { kind: 'include', includeId: 'test/wrapper', lineNumber: 2 },
		},
	});
});
