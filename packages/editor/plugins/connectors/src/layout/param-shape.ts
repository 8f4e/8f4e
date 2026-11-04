import { getCompiledFunctionForCodeBlock } from '@8f4e/editor-state';
import type { CodeBlockGraphicData, State } from '@8f4e/editor-state-types';

export function getParamShapeDeclarations(codeBlock: CodeBlockGraphicData, state: State) {
	if (codeBlock.disabled || codeBlock.blockType !== 'function') return [];
	const compiledFunction = getCompiledFunctionForCodeBlock(codeBlock, state);
	return (compiledFunction?.paramShapeExpansions ?? []).flatMap(({ lineNumber, parameters }) =>
		parameters.map((parameter, index) => ({
			sourceLineIndex: lineNumber,
			rowOffset: index + 1,
			text: `${parameter.type} ${parameter.name}`,
		}))
	);
}
