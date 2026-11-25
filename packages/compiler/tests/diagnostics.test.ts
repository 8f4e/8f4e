import { CompilerError, serializeDiagnostic } from '@8f4e/compiler-diagnostics';
import type { CompileProjectOptions, ProjectObjectModel } from '@8f4e/language-spec';
import { getProjectGroups, getProjectModules, IncludeErrorCode } from '@8f4e/language-spec';
import { SyntaxErrorCode } from '@8f4e/tokenizer';
import { describe, expect, it } from 'vitest';
import { compileProject, parseProjectSource } from '../src';

async function diagnosticFor(project: ProjectObjectModel, options: CompileProjectOptions = {}) {
	try {
		await compileProject(project, options);
	} catch (error) {
		return serializeDiagnostic(error, 'test host');
	}
	throw new Error('Expected compilation to fail');
}

describe('edited group wrappers', () => {
	function projectWithEditedWrapper(code: string[]): ProjectObjectModel {
		const project = parseProjectSource(`8f4e/v1
entry main
group parent
entry main
group voice
entry main
module oscillator
int value 1
moduleEnd
entryEnd
groupEnd
entryEnd
groupEnd
entryEnd`);
		const [parent] = getProjectGroups(project);
		const [voice] = getProjectGroups(parent);
		// The editor supplies the independently owned wrapper and expanded child project to compileProject.
		voice.code = [...code];
		return project;
	}

	it.each([
		{
			name: 'unsupported statement',
			code: ['group voice', '; keep this row', 'push 1', 'groupEnd'],
			row: 2,
			instruction: 'push',
			message: 'instruction "push" is not allowed in a group body',
			errorCode: SyntaxErrorCode.INSTRUCTION_NOT_ALLOWED_IN_BLOCK,
		},
		{
			name: 'nested opener',
			code: ['group voice', 'group ghost', 'groupEnd'],
			row: 1,
			instruction: 'group',
			message: 'mixed block type markers',
			errorCode: SyntaxErrorCode.INVALID_BLOCK_STRUCTURE,
		},
		{
			name: 'early closer',
			code: ['group voice', 'groupEnd', 'groupEnd'],
			row: 1,
			instruction: 'groupEnd',
			message: 'not at the end of the block',
			errorCode: SyntaxErrorCode.INVALID_BLOCK_STRUCTURE,
		},
		{
			name: 'missing template name',
			code: ['group voice use', 'groupEnd'],
			row: 0,
			instruction: 'group',
			message: 'Expected one template name',
			errorCode: SyntaxErrorCode.INVALID_TEMPLATE_NAME,
		},
		{
			name: 'wrong opener',
			code: ['module voice', 'moduleEnd'],
			row: 0,
			instruction: 'module',
			message: 'expected opener "group"',
			errorCode: SyntaxErrorCode.INVALID_BLOCK_STRUCTURE,
		},
		{
			name: 'missing closer',
			code: ['group voice'],
			row: 0,
			instruction: undefined,
			message: 'unknown or missing closer',
			errorCode: SyntaxErrorCode.INVALID_BLOCK_STRUCTURE,
		},
		{
			name: 'malformed declaration after leading blank and comment',
			code: ['', 'group voice', '; keep this row', 'pass; missing namespace', 'groupEnd', ''],
			row: 3,
			instruction: 'pass',
			message: 'Missing required namespace',
			errorCode: SyntaxErrorCode.MISSING_ARGUMENT,
		},
	])('reports $name at the original wrapper row', async ({ code, row, instruction, message, errorCode }) => {
		const project = projectWithEditedWrapper(code);
		const [voice] = getProjectGroups(getProjectGroups(project)[0]);
		expect(await diagnosticFor(project)).toMatchObject({
			kind: 'source',
			domain: 'syntax',
			code: errorCode,
			...(instruction ? { instruction } : {}),
			message: expect.stringContaining(message),
			location: { kind: 'block', projectBlockId: voice.id, projectGroupPath: 'parent', lineNumber: row },
		});
	});

	it('compiles the existing child project when authoring a template that has not been saved yet', async () => {
		const project = projectWithEditedWrapper(['', 'group voice use authored; comment', 'groupEnd', '']);
		expect((await compileProject(project)).compiledModules['parent/voice/oscillator']).toBeDefined();
	});
});

describe('compiler source locations', () => {
	it('locates an invalid exposure after nested blocks at its owning block row', async () => {
		const project = parseProjectSource(`8f4e/v1
entry main
group outer
entry main
group inner
entry main
module source
int value
moduleEnd
entryEnd
; declaration follows an extracted module
expose output &source:missing
groupEnd
entryEnd
groupEnd
entryEnd`);
		const [inner] = getProjectGroups(getProjectGroups(project)[0]);
		expect(await diagnosticFor(project)).toMatchObject({
			kind: 'source',
			domain: 'semantic',
			instruction: 'expose',
			location: { kind: 'block', projectBlockId: inner.id, projectGroupPath: 'outer', lineNumber: 2 },
			message: expect.stringContaining('outer/inner/source:missing'),
		});
	});
	it('locates unresolved expression constants in nested module source', async () => {
		const project = parseProjectSource(`8f4e/v1
entry main
group audio
entry main
module reader
float[] samples 8
float* cursor &samples+OFFSET
moduleEnd
entryEnd
groupEnd
entryEnd`);
		const group = getProjectGroups(project)[0];
		const result = await diagnosticFor(project);
		expect(result).toMatchObject({
			kind: 'source',
			domain: 'semantic',
			message: expect.stringContaining('OFFSET'),
			location: {
				kind: 'block',
				projectGroupPath: 'audio',
				projectBlockId: getProjectModules(group)[0].id,
				lineNumber: 2,
			},
		});
	});

	it('keeps included symbol positions and the declaration that loaded them', async () => {
		const project = parseProjectSource(`8f4e/v1
includes
include helpers
includesEnd`);
		const result = await diagnosticFor(project, {
			resolveInclude: () => `function invalid
#export
push
functionEnd`,
		});
		expect(result).toMatchObject({
			kind: 'source',
			domain: 'syntax',
			location: {
				kind: 'include',
				includeId: 'helpers',
				symbolName: 'invalid',
				projectGroupPath: '',
				lineNumber: 2,
				includeSite: { projectBlockId: project.includes[0].id, lineNumber: 1 },
			},
		});
	});

	it.each([
		{
			name: 'invalid export syntax',
			source: 'function first\n#export\nfunctionEnd\n\nfunction helper\n#export first second\nfunctionEnd',
			lineNumber: 5,
			domain: 'syntax',
		},
		{
			name: 'duplicate exports',
			code: IncludeErrorCode.DUPLICATE_EXPORT,
			source: 'function first\n#export\nfunctionEnd\n\nfunction helper\n#export\n#export\nfunctionEnd',
			lineNumber: 6,
			domain: 'include',
		},
		{
			name: 'missing exports',
			code: IncludeErrorCode.MISSING_EXPORT,
			source: 'function helper\nfunctionEnd',
			lineNumber: 0,
			domain: 'include',
		},
		{
			name: 'ambiguous calls',
			code: IncludeErrorCode.AMBIGUOUS_CALL_TARGET,
			source:
				'function caller\n#export\ncall convert 1\nfunctionEnd int\nfunction convert\n#export\nparam int value\nfunctionEnd int\nfunction convert\nparam float value\nfunctionEnd float',
			lineNumber: 2,
			domain: 'include',
		},
		{
			name: 'ambiguous calls with a continued target',
			code: IncludeErrorCode.AMBIGUOUS_CALL_TARGET,
			source:
				'function first\n#export\nfunctionEnd\n\nfunction caller\n#export\ncall; target below\n- convert 1\nfunctionEnd int\nfunction convert\n#export\nparam int value\nfunctionEnd int\nfunction convert\nparam float value\nfunctionEnd float',
			lineNumber: 6,
			domain: 'include',
		},
	])('keeps include-file ownership during $name validation', async ({ source, lineNumber, domain, code }) => {
		const project = parseProjectSource(`8f4e/v1
entry main
group audio
includes
include helpers
includesEnd
groupEnd
entryEnd`);
		const group = getProjectGroups(project)[0];
		expect(await diagnosticFor(project, { resolveInclude: () => source })).toMatchObject({
			kind: 'source',
			domain,
			...(code !== undefined ? { code } : {}),
			location: {
				kind: 'include-file',
				includeId: 'helpers',
				lineNumber,
				includeSite: { projectBlockId: group.includes[0].id, projectGroupPath: 'audio', lineNumber: 1 },
			},
		});
	});

	it('reports invalid declaration defaults at their source line', async () => {
		const project = parseProjectSource(`8f4e/v1
entry main
module reader
float* cursor &missing
moduleEnd
entryEnd`);
		expect(await diagnosticFor(project)).toMatchObject({
			kind: 'source',
			domain: 'semantic',
			location: {
				kind: 'block',
				projectBlockId: getProjectModules(project)[0].id,
				projectGroupPath: '',
				lineNumber: 1,
			},
		});
	});

	it.each([false, true])('locates an unexpected resolver failure (transported: %s)', async transported => {
		const project = parseProjectSource(`8f4e/v1
entry main
group audio
includes
include helpers
includesEnd
groupEnd
entryEnd`);
		const group = getProjectGroups(project)[0];
		const original = new Error('Resolver unavailable');
		const serialized = serializeDiagnostic(original, 'include loading');
		expect(
			await diagnosticFor(project, {
				resolveInclude: async () => {
					throw transported ? new CompilerError(structuredClone(serialized)) : original;
				},
			})
		).toEqual({
			...serialized,
			location: { kind: 'block', projectBlockId: group.includes[0].id, projectGroupPath: 'audio', lineNumber: 1 },
		});
	});
});
