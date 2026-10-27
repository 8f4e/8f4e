import type { CodeBlockGraphicData, EditorDirectiveDefinition } from '@8f4e/editor-state-types';
import { createPianoDirectiveData } from '../helpers/data';
import type { PianoKeyboard } from '../types';
import { createPianoDirectiveLayoutCallbacks } from './layout';

export function createPianoDirective(
	keyboardsByBlock: WeakMap<CodeBlockGraphicData, PianoKeyboard[]>
): EditorDirectiveDefinition {
	return {
		name: 'piano',
		clearDerivedBlockData: codeBlock => {
			keyboardsByBlock.set(codeBlock, []);
		},
		apply: (directive, draft) => {
			const data = createPianoDirectiveData(directive.args, directive.sourceLineIndex);
			if (!data) return;
			draft.addVerticalSpaceAfterSourceLine({ sourceLineIndex: directive.sourceLineIndex, heightInRows: 6 });
			draft.layoutCallbacks.push(createPianoDirectiveLayoutCallbacks(data, keyboardsByBlock));
		},
	};
}
