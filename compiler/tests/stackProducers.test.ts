import { createFunctionId } from '@8f4e/language-spec';
import { describe, expect, it } from 'vitest';
import { compileProject, parseProjectSource } from '../src';

async function analyze(lines: string[]) {
	const project = parseProjectSource(`8f4e/v1\nentry main\n${lines.join('\n')}\nentryEnd`);
	const result = await compileProject(project, { includeStackAnalysis: true });
	return result.compiledModules.test.stackAnalysis!;
}

function summary(lines: Awaited<ReturnType<typeof analyze>>) {
	return lines.map(line => [line.instruction, line.lineNumber, line.consumedOperandProducerLines]);
}

describe('immediate stack producers', () => {
	it('tracks stack positions even when values are equal and preserves untouched inputs', async () => {
		expect(
			summary(await analyze(['module test', 'push 2', 'push 2', 'push 2', 'add', 'mul', 'drop', 'moduleEnd']))
		).toEqual([
			['push', 1, []],
			['push', 2, []],
			['push', 3, []],
			['add', 4, [2, 3]],
			['mul', 5, [1, 4]],
			['drop', 6, [5]],
		]);
	});

	it('attributes conditional and block results to their closing instructions', async () => {
		const lines = await analyze([
			'module test',
			'push 99',
			'block',
			'push 1',
			'if',
			'push 1',
			'if',
			'push 2',
			'else',
			'push 3',
			'ifEnd int',
			'else',
			'push 4',
			'ifEnd int',
			'blockEnd int',
			'add',
			'drop',
			'moduleEnd',
		]);
		expect(lines.find(line => line.instruction === 'add')!.consumedOperandProducerLines).toEqual([1, 14]);
		expect(lines.find(line => line.instruction === 'blockEnd')!.consumedOperandProducerLines).toEqual([13]);
		expect(lines.find(line => line.lineNumber === 10)!.consumedOperandProducerLines).toEqual([9]);
	});

	it('groups inline operands under the source instruction without self references', async () => {
		expect(summary(await analyze(['module test', 'push 8', 'sub 3', 'drop', 'moduleEnd']))).toEqual([
			['push', 1, []],
			['sub', 2, [1]],
			['drop', 3, [2]],
		]);
		expect(summary(await analyze(['module test', 'push 8', 'sub', '- 3', 'drop', 'moduleEnd']))).toEqual([
			['push', 1, []],
			['sub', 2, [1]],
			['drop', 4, [2]],
		]);
	});

	it('retains producers on the fallthrough path of a conditional exit and clears dropped stacks', async () => {
		const lines = await analyze([
			'module test',
			'push 7',
			'push 1',
			'exitIfTrue',
			'push 3',
			'add',
			'clearStack',
			'push 9',
			'drop',
			'moduleEnd',
		]);
		expect(lines.find(line => line.instruction === 'exitIfTrue')!.consumedOperandProducerLines).toEqual([2]);
		expect(lines.find(line => line.instruction === 'add')!.consumedOperandProducerLines).toEqual([1, 4]);
		expect(lines.find(line => line.instruction === 'drop')!.consumedOperandProducerLines).toEqual([7]);
	});

	it('attributes multiple call results to the call and local reads to their push', async () => {
		const project = parseProjectSource(`8f4e/v1
entry main
module test
call pair
add
drop
moduleEnd
entryEnd
function pair
local int value
push 3
localSet value
push value
push 4
functionEnd int int`);
		const result = await compileProject(project, { includeStackAnalysis: true });
		const lines = result.compiledModules.test.stackAnalysis!;
		expect(lines.find(line => line.instruction === 'add')!.consumedOperandProducerLines).toEqual([1, 1]);
		const functionLines = result.compiledFunctions![createFunctionId('pair', [])].stackAnalysis!;
		expect(functionLines.at(-1)!.consumedOperandProducerLines).toEqual([4, 5]);
	});
});
