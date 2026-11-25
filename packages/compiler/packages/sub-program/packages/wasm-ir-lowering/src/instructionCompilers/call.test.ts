import type { SemanticCallLine } from '@8f4e/language-spec';
import { ArgumentType } from '@8f4e/language-spec';
import { describe, expect, it } from 'vitest';
import createInstructionCompilerTestContext, { createStackFacts } from '../../tests/testUtils';
import call from './call';

const targetId = 'convert__float';

function createCallLine(): SemanticCallLine {
	return {
		diagnosticSource: { kind: 'document' },
		lineNumber: 1,
		instruction: 'call',
		arguments: [{ type: ArgumentType.IDENTIFIER, value: 'convert', referenceKind: 'plain', scope: 'local' }],
	};
}

describe('call instruction compiler', () => {
	it('emits the call selected by stack analysis', () => {
		const context = createInstructionCompilerTestContext();
		call(createCallLine(), context, createStackFacts({ targetFunctionId: targetId }));
		expect(context.instructions).toEqual([{ kind: 'call', targetFunctionId: targetId }]);
	});
});
