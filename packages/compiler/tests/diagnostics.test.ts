import { serializeDiagnostic } from '@8f4e/compiler-diagnostics';
import type { CompileProjectOptions, ProjectObjectModel } from '@8f4e/language-spec';
import { getProjectGroups, getProjectModules, IncludeErrorCode } from '@8f4e/language-spec';
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

describe('compiler source locations', () => {
	it('locates an invalid exposure after nested blocks at its owning scope row', async () => {
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
		expect(await diagnosticFor(project)).toMatchObject({
			kind: 'source',
			domain: 'semantic',
			instruction: 'expose',
			location: { kind: 'scope', projectGroupPath: 'outer/inner', lineNumber: 2 },
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

	it('reports inherited declaration failures at the original prototype', async () => {
		const project = parseProjectSource(`8f4e/v1
prototype state
float* cursor &missing
prototypeEnd
entry main
module reader
shape state
moduleEnd
entryEnd`);
		expect(await diagnosticFor(project)).toMatchObject({
			kind: 'source',
			domain: 'semantic',
			location: { kind: 'block', projectBlockId: project.prototypes[0].id, projectGroupPath: '', lineNumber: 1 },
		});
	});

	it('preserves the stage and known include site of an unexpected resolver failure', async () => {
		const project = parseProjectSource(`8f4e/v1
includes
include helpers
includesEnd`);
		expect(
			await diagnosticFor(project, {
				resolveInclude: async () => {
					throw new Error('Resolver unavailable');
				},
			})
		).toMatchObject({
			kind: 'internal',
			stage: 'include loading',
			message: 'Resolver unavailable',
			stack: expect.any(String),
			location: { kind: 'block', projectBlockId: project.includes[0].id, projectGroupPath: '', lineNumber: 1 },
		});
	});
});
