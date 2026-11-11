import { projectInstructions } from '@8f4e/language-spec';
import { expect, it } from 'vitest';
import { isBlock, readProjectSource, sourceLines, validateProjectCodeBlock } from './projectSource';

it('keeps note examples opaque and preserves original source positions and text', () => {
	const lines = [
		'8f4e/v1',
		'note',
		'entry fake',
		'groupEnd',
		'template ignored',
		'noteEnd',
		'entry main',
		'group voice',
		'entry main',
		'module oscillator',
		'int phase',
		'moduleEnd',
		'entryEnd',
		'groupEnd',
		'entryEnd',
	];
	const nodes = readProjectSource(lines.join('\n'));
	expect(sourceLines(nodes)).toEqual(lines);
	const blocks = nodes.filter(isBlock);
	expect(blocks[0].children).toEqual([
		{ text: 'entry fake', lineNumber: 3 },
		{ text: 'groupEnd', lineNumber: 4 },
		{ text: 'template ignored', lineNumber: 5 },
	]);
	expect(blocks[1].start.lineNumber).toBe(7);
	const group = blocks[1].children.filter(isBlock)[0];
	expect(group.start.lineNumber).toBe(8);
	expect(group.children.filter(isBlock)[0].children.filter(isBlock)[0].start.lineNumber).toBe(10);
});

it('only recognizes preprocessing scopes when the caller registers their delimiters', () => {
	const source = 'template voice; definition\nentry main\nentryEnd\ntemplateEnd';
	const ordinary = readProjectSource(source);
	expect(ordinary[0]).toEqual({ text: 'template voice; definition', lineNumber: 1 });
	const [template] = readProjectSource(source, [projectInstructions.template]);
	expect(isBlock(template) && template.opener).toBe('template');
	expect(sourceLines([template]).join('\n')).toBe(source);
});

it('validates a flat group shell while normal source reading accepts its separately owned children', () => {
	const source = 'group voice\nentry main\nmodule oscillator\nmoduleEnd\nentryEnd\ngroupEnd';
	expect(() => readProjectSource(source)).not.toThrow();
	expect(() => validateProjectCodeBlock(source.split('\n'), 0)).toThrow('mixed block type markers');
	expect(() => validateProjectCodeBlock(['group voice', 'pass env', 'groupEnd'], 0)).not.toThrow();
});

it('reports unclosed notes rather than interpreting their embedded block markers', () => {
	expect(() => readProjectSource('note\nmodule fake\nmoduleEnd\ngroupEnd')).toThrow(
		'unclosed block with opener "note"'
	);
});

it('attaches block-relative source locations to structural diagnostics', () => {
	let error: unknown;
	try {
		readProjectSource('entry main\nmodule voice\nint value\nconstants nested\nconstantsEnd\nmoduleEnd\nentryEnd');
	} catch (caught) {
		error = caught;
	}
	expect(error).toMatchObject({
		diagnostic: {
			instruction: 'constants',
			location: { kind: 'block', projectBlockId: 2, projectGroupPath: '', lineNumber: 2 },
		},
	});
});
