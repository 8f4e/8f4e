import { CompilerError } from '@8f4e/compiler-diagnostics';
import { ErrorCode, getProjectGroups, getProjectModules } from '@8f4e/language-spec';
import { SyntaxErrorCode } from '@8f4e/tokenizer';
import { describe, expect, it } from 'vitest';
import { parseProjectSource } from './parseProjectSource';
import { extractProjectTemplates, inlineProjectTemplates } from './projectTemplates';

const body = `function helper
param int x
push x
functionEnd int
includes
include std/math/trig/sine
includesEnd
constants settings
const GAIN 2
constantsEnd
prototype state
int value 1
prototypeEnd
note
useTemplate ignored
entry fake
template fake
noteEnd
entry empty
entryEnd
entry main
module processor
; @pos 12 34
int value 1
moduleEnd
entryEnd`;
const definition = `template voice\n${body}\ntemplateEnd`;
const instance = (name: string) =>
	`group ${name}\n; @pos 4 5\nexpose out &processor:value\ninit &out 7\npass env\nuseTemplate voice\ngroupEnd`;
const source = (content: string) => `8f4e/v1\n${content}`;
const groups = (text: string) => getProjectGroups(parseProjectSource(text));
function thrown(text: string) {
	try {
		inlineProjectTemplates(text);
	} catch (error) {
		return error;
	}
	throw new Error('Expected preprocessing to fail');
}

describe('scope-local template inlining', () => {
	it('expands forward references into ordinary independent groups and retains each outer shell', () => {
		const [a, b] = groups(source(`entry main\n${instance('a')}\n${instance('b')}\nentryEnd\n${definition}`));
		expect(a.code).toContain('useTemplate voice');
		expect(a.code).toContain('pass env');
		expect(a.exposures).toHaveLength(1);
		expect(a.entries).toEqual(['empty', 'main']);
		expect(a.functions[0].code[0]).toBe('function helper');
		expect(a.includes).toHaveLength(1);
		expect(a.constants).toHaveLength(1);
		expect(a.prototypes).toHaveLength(1);
		expect(a.notes[0].code).toContain('template fake');
		expect(getProjectModules(a)[0].code).toContain('; @pos 12 34');
		expect(Object.keys(a)).not.toContain('templateId');
		expect(getProjectModules(a)[0].id).not.toBe(getProjectModules(b)[0].id);
		getProjectModules(a)[0].code.push('; independent edit');
		expect(getProjectModules(b)[0].code).not.toContain('; independent edit');
	});

	it('supports local templates inside copied templates without leaking them between instances', () => {
		const text = source(`template outer
${definition}
entry main
${instance('child')}
entryEnd
templateEnd
entry main
group a
useTemplate outer
groupEnd
group b
useTemplate outer
groupEnd
entryEnd`);
		const [a, b] = groups(text);
		expect(getProjectGroups(a)[0].functions).toHaveLength(1);
		expect(getProjectGroups(b)[0].functions).toHaveLength(1);
	});

	it('resolves identical names independently in separate scopes', () => {
		const scoped = (name: string, value: number) =>
			`group ${name}\ntemplate voice\nentry main\nmodule x\nint value ${value}\nmoduleEnd\nentryEnd\ntemplateEnd\nentry main\n${instance('child')}\nentryEnd\ngroupEnd`;
		const [a, b] = groups(source(`entry main\n${scoped('a', 1)}\n${scoped('b', 2)}\nentryEnd`));
		expect(getProjectModules(getProjectGroups(a)[0])[0].code).toContain('int value 1');
		expect(getProjectModules(getProjectGroups(b)[0])[0].code).toContain('int value 2');
	});

	it('does not search ancestors or sibling groups for definitions', () => {
		const error = thrown(
			source(`${definition}\nentry main\ngroup parent\nentry main\n${instance('child')}\nentryEnd\ngroupEnd\nentryEnd`)
		);
		expect(error).toBeInstanceOf(Error);
		expect(error).toMatchObject({ diagnostic: expect.objectContaining({ code: ErrorCode.UNDEFINED_TEMPLATE }) });
		const sibling = thrown(source(`entry main\ngroup a\n${definition}\ngroupEnd\n${instance('b')}\nentryEnd`));
		expect(sibling).toMatchObject({ diagnostic: expect.objectContaining({ code: ErrorCode.UNDEFINED_TEMPLATE }) });
	});

	it('rejects recursive references instead of making the enclosing template visible', () => {
		expect(
			thrown(
				source(
					`template voice\nentry main\n${instance('child')}\nentryEnd\ntemplateEnd\nentry main\n${instance('a')}\nentryEnd`
				)
			)
		).toMatchObject({ diagnostic: expect.objectContaining({ code: ErrorCode.RECURSIVE_TEMPLATE }) });
	});

	it('rejects duplicate definitions only within the same owning scope', () => {
		expect(thrown(source(`${definition}\n${definition}`))).toMatchObject({
			diagnostic: expect.objectContaining({ code: ErrorCode.DUPLICATE_TEMPLATE }),
		});
	});

	it.each([
		'entry main\nentryEnd',
		'module x\nmoduleEnd',
		'function x\nfunctionEnd',
		'constants x\nconstantsEnd',
		'prototype x\nprototypeEnd',
		'includes\nincludesEnd',
		'note\nnoteEnd',
		'group x\ngroupEnd',
		'template x\ntemplateEnd',
	])('rejects inline child content: %s', content => {
		const text = source(`${definition}\nentry main\ngroup a\nuseTemplate voice\n${content}\ngroupEnd\nentryEnd`);
		expect(thrown(text)).toMatchObject({
			diagnostic: expect.objectContaining({ code: SyntaxErrorCode.TEMPLATE_INSTANCE_HAS_CONTENT }),
		});
	});

	it('rejects repeated useTemplate instructions before expansion', () => {
		const error = thrown(
			source(`${definition}\nentry main\ngroup a\nuseTemplate voice\nuseTemplate voice\ngroupEnd\nentryEnd`)
		);
		expect(error).toBeInstanceOf(CompilerError);
		expect(error).toMatchObject({
			diagnostic: expect.objectContaining({
				code: SyntaxErrorCode.MULTIPLE_TEMPLATE_REFERENCES,
				instruction: 'useTemplate',
			}),
		});
	});

	it.each([
		'template',
		'template a b',
		'template bad/name',
		'template; missing name',
		'useTemplate',
		'useTemplate a b',
		'useTemplate bad/name',
	])('validates instruction arguments: %s', line => {
		const text = line.startsWith('template')
			? source(`${line}\ntemplateEnd`)
			: source(`entry main\ngroup a\n${line}\ngroupEnd\nentryEnd`);
		expect(thrown(text)).toMatchObject({
			diagnostic: expect.objectContaining({ code: SyntaxErrorCode.INVALID_TEMPLATE_NAME }),
		});
	});

	it.each([
		'useTemplate voice',
		'entry main\nuseTemplate voice\nentryEnd',
		'entry main\ntemplate voice\ntemplateEnd\nentryEnd',
		'entry main\nmodule x\nuseTemplate voice\nmoduleEnd\nentryEnd',
	])('rejects template syntax in invalid contexts: %s', content => {
		expect(thrown(source(content))).toMatchObject({
			diagnostic: expect.objectContaining({ code: SyntaxErrorCode.INSTRUCTION_NOT_ALLOWED_IN_BLOCK }),
		});
	});

	it('rejects declaration lines in template bodies', () => {
		expect(thrown(source('template voice\npass env\ntemplateEnd'))).toMatchObject({
			diagnostic: expect.objectContaining({ code: SyntaxErrorCode.INVALID_TEMPLATE_CONTENT }),
		});
	});

	it('preserves note contents and untouched sources byte for byte', () => {
		const text = source('note\ntemplate fake\nuseTemplate fake\ngroupEnd\nentryEnd\nnoteEnd');
		expect(inlineProjectTemplates(text)).toBe(text);
		expect(extractProjectTemplates(text)).toBe(text);
		expect(inlineProjectTemplates(source('entry main\nmodule x\nmoduleEnd\nentryEnd'))).toBe(
			source('entry main\nmodule x\nmoduleEnd\nentryEnd')
		);
	});

	it('allows inline comments on template names and removes unused definitions', () => {
		expect(
			groups(
				source(
					'template voice ; definition\nentry empty\nentryEnd\ntemplateEnd\nentry main\ngroup a\nuseTemplate voice; reference\ngroupEnd\nentryEnd'
				)
			)[0].entries
		).toEqual(['empty']);
		const unused = parseProjectSource(source(definition));
		expect(unused.execution).toEqual([]);
		expect(unused.functions).toEqual([]);
		expect(unused.code).toEqual([]);
	});

	it.each(['template voice', 'template voice\nentry main\ntemplateEnd', 'templateEnd'])(
		'rejects malformed block structure: %s',
		content => {
			expect(thrown(source(content))).toMatchObject({
				diagnostic: expect.objectContaining({ code: SyntaxErrorCode.INVALID_BLOCK_STRUCTURE }),
			});
		}
	);
});

it('validates bare commented references and template closer arguments in the inlining stage', () => {
	expect(thrown(source('entry main\ngroup a\nuseTemplate; missing name\ngroupEnd\nentryEnd'))).toMatchObject({
		diagnostic: expect.objectContaining({ code: SyntaxErrorCode.INVALID_TEMPLATE_NAME }),
	});
	expect(thrown(source('template voice\ntemplateEnd extra'))).toMatchObject({
		diagnostic: expect.objectContaining({ code: SyntaxErrorCode.INVALID_BLOCK_STRUCTURE }),
	});
});
