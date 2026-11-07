import { createChildProjectGroupPath, createFunctionId, ROOT_PROJECT_GROUP_PATH } from '@8f4e/language-spec';
import { describe, expect, it } from 'vitest';
import { compileProject, parseProjectSource } from '../src';

describe('function analysis', () => {
	it.each([false, true])('exposes structural facts with includeStackAnalysis=%s', async includeStackAnalysis => {
		const result = await compileProject(
			parseProjectSource(`8f4e/v1
function imported
#import imported
functionEnd

function fallthrough
#export
push 7
functionEnd int

function terminalReturn
return
; Trailing declarations and comments are not executable operations.
local int unused
functionEnd

function earlyReturn
push 1
if
return
ifEnd
functionEnd

function returnBeforeWork
return
push 1
drop
functionEnd

function structured
param int condition
push condition
if
loop 2
loopEnd
ifEnd
functionEnd

function readValue
#impure
param int* address
push address
load
functionEnd int

function self
call self
functionEnd

function first
call second
functionEnd

function second
call first
functionEnd

function caller
call first
functionEnd

function overloaded
param int value
call overloaded value
functionEnd

function overloaded
param float value
functionEnd
`),
			{ includeStackAnalysis }
		);
		const facts = (name: string, parameters: Parameters<typeof createFunctionId>[1] = []) =>
			result.compiledFunctions![createFunctionId(name, parameters)].analysis;
		const ordinary = { isImported: false, hasExplicitReturn: false, hasEarlyReturn: false, isRecursive: false };
		expect(facts('fallthrough')).toEqual(ordinary);
		expect(facts('structured', ['int'])).toEqual(ordinary);
		expect(facts('readValue', ['int*'])).toEqual(ordinary);
		expect(facts('imported')).toEqual({ ...ordinary, isImported: true });
		expect(facts('terminalReturn')).toEqual({ ...ordinary, hasExplicitReturn: true });
		expect(facts('earlyReturn')).toEqual({ ...ordinary, hasExplicitReturn: true, hasEarlyReturn: true });
		expect(facts('returnBeforeWork')).toEqual({ ...ordinary, hasExplicitReturn: true, hasEarlyReturn: true });
		for (const name of ['self', 'first', 'second']) {
			expect(facts(name)).toEqual({ ...ordinary, isRecursive: true });
		}
		expect(facts('caller')).toEqual(ordinary);
		expect(facts('overloaded', ['int'])).toEqual({ ...ordinary, isRecursive: true });
		expect(facts('overloaded', ['float'])).toEqual(ordinary);
		expect(WebAssembly.validate(new Uint8Array(result.codeBuffer))).toBe(true);
	});

	it('keeps group-local functions with the same source name separate', async () => {
		const result = await compileProject(
			parseProjectSource(`8f4e/v1
function helper
call helper
functionEnd
entry main
group child
function helper
functionEnd
groupEnd
entryEnd
`)
		);
		const functions = Object.values(result.compiledFunctions!);
		const root = functions.find(fn => fn.ast.sourceIdentity.projectGroupPath === ROOT_PROJECT_GROUP_PATH)!;
		const child = functions.find(
			fn => fn.ast.sourceIdentity.projectGroupPath === createChildProjectGroupPath(ROOT_PROJECT_GROUP_PATH, 'child')
		)!;
		expect(root.analysis.isRecursive).toBe(true);
		expect(child.analysis.isRecursive).toBe(false);
	});

	it('detects recursion through nested entry dispatchers and module bodies', async () => {
		const result = await compileProject(
			parseProjectSource(`8f4e/v1
function roundTrip
call main
functionEnd
entry main
group child
pass roundTrip
entry main
module caller
call roundTrip
moduleEnd
entryEnd
groupEnd
entryEnd
`)
		);
		expect(result.compiledFunctions![createFunctionId('roundTrip', [])].analysis.isRecursive).toBe(true);
	});

	it('excludes skipped module dispatches from recursion paths', async () => {
		const result = await compileProject(
			parseProjectSource(`8f4e/v1
function roundTrip
call main
functionEnd
entry main
module skipped
#skipExecution
call roundTrip
moduleEnd
entryEnd
`)
		);
		expect(result.compiledFunctions![createFunctionId('roundTrip', [])].analysis.isRecursive).toBe(false);
	});

	it('recomputes call cycles when unchanged functions are restored from the AST cache', async () => {
		const project = parseProjectSource(`8f4e/v1
function first
call second
functionEnd
function second
functionEnd
`);
		const first = await compileProject(project);
		project.functions[1].code.splice(1, 0, 'call first');
		const second = await compileProject(project, { cache: first.cache });
		const functionId = createFunctionId('first', []);
		expect(first.compiledFunctions![functionId].analysis.isRecursive).toBe(false);
		expect(second.compiledFunctions![functionId].analysis.isRecursive).toBe(true);
		expect(second.cache.ast.stats.hits).toBeGreaterThan(0);
	});
});
