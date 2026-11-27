import { compileProject, parseProjectSource } from '@8f4e/compiler';
import { createMockCodeBlock, createMockState } from '@8f4e/editor-state-testing';
import { getProjectModules } from '@8f4e/language-spec';
import { expect, it } from 'vitest';
import { refreshBlockSourceMetadata } from '../project/blocks/refreshSourceMetadata';
import getMemoryTargetAtSourceLine from './getMemoryTargetAtSourceLine';

it('finds named and anonymous declarations by source row only in the active module block', async () => {
	const project = parseProjectSource(`8f4e/v1
entry main
module values
int value 0
moduleEnd
module values
int value 1
float other 2
int 3
moduleEnd
entryEnd`);
	const compiled = await compileProject(project);
	const state = createMockState();
	state.compiler.result = { ...state.compiler.result, ...compiled };
	const [inactive, active] = getProjectModules(project).map(({ id, code }) =>
		createMockCodeBlock({ blockType: 'module', name: 'values', code, creationIndex: id })
	);
	const [first, last, anonymous] = compiled.memoryPlan.modules.values.declarations;

	expect(getMemoryTargetAtSourceLine(state, inactive, 1)).toEqual({ target: undefined });
	expect(getMemoryTargetAtSourceLine(state, active, 1)?.target?.memory).toBe(first);
	expect(getMemoryTargetAtSourceLine(state, active, 2)?.target?.memory).toBe(last);
	expect(getMemoryTargetAtSourceLine(state, active, 3)?.target?.memory).toBe(anonymous);
	expect(anonymous.name).toBeUndefined();

	// A source edit may precede the compiler result; don't resolve a different declaration from that result.
	active.code[1] = 'float value 1';
	active.code[2] = 'float replacement 2';
	expect(getMemoryTargetAtSourceLine(state, active, 1)).toEqual({ target: undefined });
	expect(getMemoryTargetAtSourceLine(state, active, 2)).toEqual({ target: undefined });
});

it('resolves compiled memory from the owning instruction despite an unrelated incomplete continuation', async () => {
	const project = parseProjectSource(
		[
			'8f4e/v1',
			'entry main',
			'module audio',
			'int[] samples ; @watch',
			'- 2 1 2',
			'push',
			'- 8 ; @stack',
			'drop',
			'moduleEnd',
			'entryEnd',
		].join('\n')
	);
	const compiled = await compileProject(project, { includeStackAnalysis: true });
	const state = createMockState();
	state.compiler.result = { ...state.compiler.result, ...compiled };
	const [{ id, code }] = getProjectModules(project);
	const block = createMockCodeBlock({ blockType: 'module', name: 'audio', code, creationIndex: id });
	const editedCode = [...block.code];
	const declarationRow = editedCode.indexOf('int[] samples ; @watch');
	const declarationContinuationRow = editedCode.indexOf('- 2 1 2');
	const pushRow = editedCode.indexOf('push');
	const stackContinuationRow = editedCode.indexOf('- 8 ; @stack');
	const incompleteContinuationRow = editedCode.indexOf('moduleEnd');
	editedCode.splice(incompleteContinuationRow, 0, '-');
	block.code = editedCode;
	refreshBlockSourceMetadata(block, []);

	expect(block.sourcePreparation?.instructionLineBySourceLine[declarationContinuationRow]).toBe(declarationRow);
	expect(block.sourcePreparation?.instructionLineBySourceLine[stackContinuationRow]).toBe(pushRow);
	expect(block.sourcePreparation?.instructionLineBySourceLine[incompleteContinuationRow]).toBeUndefined();
	expect(block.sourcePreparation?.lines.find(line => line.lineNumber === pushRow)?.line).toBe('push 8');
	expect(getMemoryTargetAtSourceLine(state, block, declarationRow)?.target?.memory.name).toBe('samples');
});
