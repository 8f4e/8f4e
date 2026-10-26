import type { DirectiveDerivedState, VerticalSpaceAfterSourceLine } from '@8f4e/editor-state-types';

// The draft and completed state share this function, keeping the requests private to core.
const requestsByAdder = new WeakMap<
	DirectiveDerivedState['addVerticalSpaceAfterSourceLine'],
	VerticalSpaceAfterSourceLine[]
>();

export function createVerticalSpaceAfterSourceLineAdder(): DirectiveDerivedState['addVerticalSpaceAfterSourceLine'] {
	const requests: VerticalSpaceAfterSourceLine[] = [];
	const addVerticalSpaceAfterSourceLine = (space: VerticalSpaceAfterSourceLine): void => {
		requests.push(space);
	};
	requestsByAdder.set(addVerticalSpaceAfterSourceLine, requests);
	return addVerticalSpaceAfterSourceLine;
}

export function getVerticalSpaceAfterSourceLineRequests(
	directiveState: DirectiveDerivedState
): readonly VerticalSpaceAfterSourceLine[] {
	return requestsByAdder.get(directiveState.addVerticalSpaceAfterSourceLine)!;
}
