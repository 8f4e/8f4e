import { describe, expect, it } from 'vitest';
import { compileToAST } from '../src';

describe('compileToAST integration', () => {
	it('preserves arithmetic-looking strings through complete function compilation', () => {
		const ast = compileToAST(['function demo', 'push "2*3.0"', 'functionEnd int'], { kind: 'document' });

		expect(ast.lines).toContainEqual(
			expect.objectContaining({
				instruction: 'push',
				arguments: [{ type: 'string_literal', value: '2*3.0' }],
			})
		);
	});

	it('tokenizes source blocks into validated ASTs from source-shaped fixtures', () => {
		expect({
			module: compileToAST(
				[
					'module synth',
					'#skipExecution',
					'float phase 0.5',
					'int[] buffer',
					'- 4',
					'- 0x0A',
					'float* readHead &audio:samples',
					'push "ready"',
					'push count(buffer)',
					'float& samples &audio:samples',
					'push sizeof(*samples)',
					'push &buffer',
					'push buffer&',
					'push *readHead',
					'if',
					'push 1',
					'else',
					'push 0',
					'ifEnd int',
					'moduleEnd',
				],
				{ kind: 'document' }
			),
			function: compileToAST(
				[
					'const SCALE 2',
					'function mix',
					'#export mixExport',
					'param int left',
					'param float right',
					'local float output',
					'block',
					'push right',
					'blockEnd float',
					'push left',
					'functionEnd int float',
				],
				{ kind: 'document' }
			),
			constants: compileToAST(
				['constants sizes', 'const TABLE_SIZE 4*2', 'const START &synth:buffer', 'constantsEnd'],
				{ kind: 'document' }
			),
			prototype: compileToAST(['prototype state', 'float phase', 'int[] history', '- TABLE_SIZE', 'prototypeEnd'], {
				kind: 'document',
			}),
		}).toMatchSnapshot();
	});
});
