import { EventEmitter } from 'node:events';
import { compileProject, parseProjectSource } from '@8f4e/compiler';
import { afterEach, describe, expect, it } from 'vitest';
import initState, { applyCodeBlockSourceEdits } from '../../../index';
import { getCurrentCompiledLineForCodeBlock } from './getCurrentCompiledLineForCodeBlock';

const cleanups: Array<() => void> = [];
afterEach(() => {
	while (cleanups.length) cleanups.pop()!();
});

async function setup(blockType: 'module' | 'function') {
	const body = 'push 2\npush 3\nadd';
	const project = parseProjectSource(
		blockType === 'module'
			? `8f4e/v1\nentry main\nmodule sample\n${body}\ndrop\nmoduleEnd\nentryEnd`
			: `8f4e/v1\nfunction sample\n${body}\nfunctionEnd int`
	);
	const compiled = await compileProject(project, { includeStackAnalysis: true });
	const emitter = new EventEmitter();
	const events = { on: emitter.on.bind(emitter), off: emitter.off.bind(emitter), dispatch: emitter.emit.bind(emitter) };
	const store = initState(events, { callbacks: {} });
	cleanups.push(store.dispose);
	store.set('initialProjectState', project);
	const state = store.getState();
	const block = state.codeBlockRendering.currentProject.blocks.find(block => block.name === 'sample')!;
	store.set('compiler.result', {
		...compiled,
		inputRevision: state.compilerInputRevision,
		sourceCodeByBlockId: { [block.creationIndex]: [...block.code] },
	});
	return { store, events, state, block };
}

describe.each(['module', 'function'] as const)('current compiled lines in a %s', blockType => {
	it('returns the AST and stack facts for the requested source line', async () => {
		const { state, block } = await setup(blockType);
		const line = getCurrentCompiledLineForCodeBlock(block, state, 3)!;
		expect(line.parsedLine?.instruction).toBe('add');
		expect(line.stackAnalysisLine?.consumedOperandProducerLines).toEqual([1, 2]);
		expect(line.currentSourceLineByCompiledLine.get(1)).toBe(1);
	});

	it('maps source metadata and producer lines across comment-only edits', async () => {
		const test = await setup(blockType);
		const revision = test.state.compilerInputRevision;
		applyCodeBlockSourceEdits(
			test,
			[{ codeBlock: test.block, code: [test.block.code[0], '; @favorite', '', ...test.block.code.slice(1)] }],
			{ affectsCompilation: false }
		);
		test.store.set('codeBlockRendering.selectedCodeBlock', test.block);
		test.store.set('codeBlockRendering.selectedCodeBlock.cursor.row', 5);
		const line = getCurrentCompiledLineForCodeBlock(test.block, test.state)!;
		expect(test.state.compilerInputRevision).toBe(revision);
		expect(line.parsedLine?.instruction).toBe('add');
		expect(line.stackAnalysisLine?.lineNumber).toBe(3);
		expect(line.currentSourceLineByCompiledLine.get(1)).toBe(3);
		expect(line.currentSourceLineByCompiledLine.get(2)).toBe(4);
		expect(getCurrentCompiledLineForCodeBlock(test.block, test.state, 1)?.parsedLine).toBeUndefined();
	});

	it('rejects outdated compiler inputs while edited source waits for compilation', async () => {
		const test = await setup(blockType);
		const code = [...test.block.code];
		code[3] = 'mul';
		applyCodeBlockSourceEdits(test, [{ codeBlock: test.block, code }], { affectsCompilation: true });
		expect(getCurrentCompiledLineForCodeBlock(test.block, test.state, 3)).toBeUndefined();
	});

	it('returns no metadata when the accepted snapshot has no source for the block', async () => {
		const test = await setup(blockType);
		test.store.set('compiler.result', { ...test.state.compiler.result, sourceCodeByBlockId: {} });
		expect(getCurrentCompiledLineForCodeBlock(test.block, test.state, 3)).toBeUndefined();
	});
});
