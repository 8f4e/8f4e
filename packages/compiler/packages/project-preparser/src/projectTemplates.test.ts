import { CompilerError } from '@8f4e/compiler-diagnostics';
import { ErrorCode, getProjectGroups, getProjectModules } from '@8f4e/language-spec';
import { SyntaxErrorCode } from '@8f4e/tokenizer';
import { describe, expect, it } from 'vitest';
import { parseProjectSource } from './parseProjectSource';
import { extractProjectTemplates } from './projectTemplates';

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
note
group example use ignored
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
	`group ${name} use voice\n; @pos 4 5\nexpose out &processor:value\ninit &out 7\npass env\ngroupEnd`;
const source = (content: string) => `8f4e/v1\n${content}`;
const groups = (text: string) => getProjectGroups(parseProjectSource(text));
function thrown(text: string) {
	try {
		parseProjectSource(text);
	} catch (error) {
		return error;
	}
	throw new Error('Expected project parsing to fail');
}

describe('scope-local template inlining', () => {
	it('expands forward references into ordinary independent groups and retains each outer shell', () => {
		const [a, b] = groups(source(`entry main\n${instance('a')}\n${instance('b')}\nentryEnd\n${definition}`));
		expect(a.name).toBe('a');
		expect(b.name).toBe('b');
		expect(a.code[0]).toBe('group a use voice');
		expect(a.code).toContain('pass env');
		expect(a.exposures).toHaveLength(1);
		expect(a.entries).toEqual(['empty', 'main']);
		expect(a.functions[0].code[0]).toBe('function helper');
		expect(a.includes).toHaveLength(1);
		expect(a.constants).toHaveLength(1);
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
group a use outer
groupEnd
group b use outer
groupEnd
entryEnd`);
		const [a, b] = groups(text);
		expect(getProjectGroups(a)[0].functions).toHaveLength(1);
		expect(getProjectGroups(b)[0].functions).toHaveLength(1);
	});

	it('assigns distinct expanded-source block ids throughout nested template copies', () => {
		const text = source(`template outer
template inner
entry main
module oscillator
moduleEnd
entryEnd
templateEnd
entry main
group nested use inner
groupEnd
entryEnd
templateEnd
entry main
group a use outer
groupEnd
group b use outer
groupEnd
module tail
moduleEnd
entryEnd`);
		const project = parseProjectSource(text);
		const ids = getProjectGroups(project).flatMap(group => {
			const [nested] = getProjectGroups(group);
			return [group.id, nested.id, getProjectModules(nested)[0].id];
		});
		ids.push(getProjectModules(project)[0].id);
		// The expanded source has two ten-line group instances followed by the tail module.
		expect(ids).toEqual([3, 5, 7, 13, 15, 17, 23]);
		expect(new Set(ids).size).toBe(ids.length);
	});

	it.each([
		{ scenario: 'plain group', prefix: '', opener: 'group a', statement: 'unexpected voice' },
		{ scenario: 'unused definition', prefix: definition, opener: 'group a', statement: 'unexpected voice' },
		{ scenario: 'template instance', prefix: definition, opener: 'group a use voice', statement: 'push 1' },
	])('rejects unsupported statements at the original document line ($scenario)', ({ prefix, opener, statement }) => {
		const text = source(`${prefix}\nentry main\n${opener}\n; keep this row\n${statement}\ngroupEnd\nentryEnd`);
		const row = text.split('\n').indexOf(statement);
		expect(() => parseProjectSource(text)).toThrow(
			expect.objectContaining({
				diagnostic: expect.objectContaining({
					code: SyntaxErrorCode.INSTRUCTION_NOT_ALLOWED_IN_BLOCK,
					instruction: statement.split(' ')[0],
					location: { kind: 'document', lineNumber: row },
					message: expect.stringContaining(`Parse error at line ${row + 1}:`),
				}),
			})
		);
	});

	it('reports errors in copied group bodies at the original template declaration', () => {
		const text = source(`template voice
entry main
group nested
unsupported value
groupEnd
entryEnd
templateEnd
entry main
group a use voice
groupEnd
entryEnd`);
		expect(() => parseProjectSource(text)).toThrow(
			expect.objectContaining({
				diagnostic: expect.objectContaining({
					code: SyntaxErrorCode.INSTRUCTION_NOT_ALLOWED_IN_BLOCK,
					instruction: 'unsupported',
					location: { kind: 'document', lineNumber: 4 },
				}),
			})
		);
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
		'includes\nincludesEnd',
		'note\nnoteEnd',
		'group x\ngroupEnd',
		'template x\ntemplateEnd',
	])('rejects inline child content: %s', content => {
		const text = source(`${definition}\nentry main\ngroup a use voice\n${content}\ngroupEnd\nentryEnd`);
		expect(thrown(text)).toMatchObject({
			diagnostic: expect.objectContaining({ code: SyntaxErrorCode.TEMPLATE_INSTANCE_HAS_CONTENT }),
		});
	});

	it('rejects repeated use clauses before expansion', () => {
		const error = thrown(source(`${definition}\nentry main\ngroup a use voice use voice\ngroupEnd\nentryEnd`));
		expect(error).toBeInstanceOf(CompilerError);
		expect(error).toMatchObject({
			diagnostic: expect.objectContaining({
				code: SyntaxErrorCode.INVALID_BLOCK_STRUCTURE,
				instruction: 'group',
			}),
		});
	});

	it.each([
		'template',
		'template a b',
		'template bad/name',
		'template; missing name',
		'group a use',
		'group a use bad/name',
	])('validates instruction arguments: %s', line => {
		const text = line.startsWith('template')
			? source(`${line}\ntemplateEnd`)
			: source(`entry main\n${line}\ngroupEnd\nentryEnd`);
		expect(thrown(text)).toMatchObject({
			diagnostic: expect.objectContaining({ code: SyntaxErrorCode.INVALID_TEMPLATE_NAME }),
		});
	});

	it.each([
		'entry main\ntemplate voice\ntemplateEnd\nentryEnd',
		'entry main\nmodule x\ntemplate voice\nmoduleEnd\nentryEnd',
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
		const text = source('note\ntemplate fake\ngroup example use fake\ngroupEnd\nentryEnd\nnoteEnd');
		expect(parseProjectSource(text).notes[0].code.join('\n')).toBe(text.slice('8f4e/v1\n'.length));
		expect(extractProjectTemplates(text)).toBe(text);
		const plain = source('entry main\nmodule x\nmoduleEnd\nentryEnd');
		expect(getProjectModules(parseProjectSource(plain))).toEqual([
			{ type: 'module', id: 3, entry: 'main', code: ['module x', 'moduleEnd'] },
		]);
		expect(extractProjectTemplates(plain)).toBe(plain);
	});

	it('allows inline comments on template names and removes unused definitions', () => {
		const [group] = groups(
			source(
				'template voice ; definition\nentry empty\nentryEnd\ntemplateEnd\nentry main\ngroup a use voice; reference\ngroupEnd\nentryEnd'
			)
		);
		expect(group.entries).toEqual(['empty']);
		expect(group.code[0]).toBe('group a use voice; reference');
		const unused = parseProjectSource(source(definition));
		expect(unused.execution).toEqual([]);
		expect(unused.functions).toEqual([]);
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
	expect(thrown(source('entry main\ngroup a use; missing name\ngroupEnd\nentryEnd'))).toMatchObject({
		diagnostic: expect.objectContaining({ code: SyntaxErrorCode.INVALID_TEMPLATE_NAME }),
	});
	expect(thrown(source('template voice\ntemplateEnd extra'))).toMatchObject({
		diagnostic: expect.objectContaining({ code: SyntaxErrorCode.INVALID_BLOCK_STRUCTURE }),
	});
});

it('reports undefined templates on the group header even without any definitions', () => {
	expect(thrown(source('entry main\ngroup a use missing\ngroupEnd\nentryEnd'))).toMatchObject({
		diagnostic: expect.objectContaining({
			code: ErrorCode.UNDEFINED_TEMPLATE,
			instruction: 'group',
			location: { kind: 'document', lineNumber: 2 },
		}),
	});
});
