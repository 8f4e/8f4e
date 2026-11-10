import type { InstructionCompiler, ResolvedPushShapeLine } from '@8f4e/language-spec';
import push from './push';

/**
 * Instruction compiler for `pushShape`.
 * Emits the same bytecode as explicit `push &field` lines in prototype declaration order.
 */
const pushShape: InstructionCompiler<ResolvedPushShapeLine> = (line, context, facts) => {
	for (const { pushLine } of line.shapeExpansions) {
		push(pushLine, context, facts);
	}

	return context;
};

export default pushShape;
