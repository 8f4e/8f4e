import { describe, expect, it } from 'vitest';
import { createMockState } from '~/__tests__/helpers/mockEditorState';
import { mainMenu } from './mainMenu';

describe('main menu', () => {
	it.each([false, true])('separates navigation and contributed actions only when both exist: %s', contributed => {
		const state = createMockState({
			project: {
				rootLevel: { entries: [], path: '', blocks: [] },
				activeLevel: { entries: [], path: 'child', blocks: [] },
			},
		});
		const contribution = { title: 'Inspect', action: 'inspect' };
		const items = mainMenu(state, contributed ? [contribution] : []);
		const navigation = { title: 'Go back', action: 'goToParentProjectGroup', close: true };
		expect(items).toEqual(contributed ? [navigation, { divider: true }, contribution] : [navigation]);
	});
});
