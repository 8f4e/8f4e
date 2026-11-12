import { EventEmitter } from 'node:events';
import { compileProject, parseProjectSource } from '@8f4e/compiler';
import { afterEach, describe, expect, it } from 'vitest';
import initState, { applyCodeBlockSourceEdits, serializeProjectLevel } from '../../../index';
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
	});
	return { store, events, state, block };
}

describe.each(['module', 'function'] as const)('current compiled lines in a %s', blockType => {
	it('returns the AST and stack facts for the requested source line', async () => {
		const { state, block } = await setup(blockType);
		const line = getCurrentCompiledLineForCodeBlock(block, state, 3)!;
		expect(line.parsedLine?.instruction).toBe('add');
		expect(line.stackAnalysisLine?.consumedOperandProducerLines).toEqual([1, 2]);
	});

	it('uses newly compiled source positions after comment lines are inserted', async () => {
		const test = await setup(blockType);
		applyCodeBlockSourceEdits(
			test,
			[{ codeBlock: test.block, code: [test.block.code[0], '; comment', '', ...test.block.code.slice(1)] }],
			{ affectsCompilation: true }
		);
		test.store.set('codeBlockRendering.selectedCodeBlock', test.block);
		test.store.set('codeBlockRendering.selectedCodeBlock.cursor.row', 5);
		expect(getCurrentCompiledLineForCodeBlock(test.block, test.state)).toBeUndefined();
		const compiled = await compileProject(serializeProjectLevel(test.state.codeBlockRendering.rootProject), {
			includeStackAnalysis: true,
		});
		test.store.set('compiler.result', { ...compiled, inputRevision: test.state.compilerInputRevision });
		const line = getCurrentCompiledLineForCodeBlock(test.block, test.state)!;
		expect(line.parsedLine?.lineNumber).toBe(5);
		expect(line.stackAnalysisLine?.lineNumber).toBe(5);
		expect(line.stackAnalysisLine?.consumedOperandProducerLines).toEqual([3, 4]);
	});

	it('rejects outdated compiler inputs while edited source waits for compilation', async () => {
		const test = await setup(blockType);
		const code = [...test.block.code];
		code[3] = 'mul';
		applyCodeBlockSourceEdits(test, [{ codeBlock: test.block, code }], { affectsCompilation: true });
		expect(getCurrentCompiledLineForCodeBlock(test.block, test.state, 3)).toBeUndefined();
	});

	it('returns no metadata when accepted reports have no matching source definition', async () => {
		const test = await setup(blockType);
		test.store.set('compiler.result', { ...test.state.compiler.result, compiledModules: {}, compiledFunctions: {} });
		expect(getCurrentCompiledLineForCodeBlock(test.block, test.state, 3)).toBeUndefined();
	});
});
