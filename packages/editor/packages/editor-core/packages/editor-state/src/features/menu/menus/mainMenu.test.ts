import { describe, expect, it } from 'vitest';
import { createMockState } from '~/pureHelpers/testingUtils/testUtils';
import { mainMenu } from './mainMenu';

describe('main menu', () => {
	it.each([true, false])('offers new project creation when enabled: %s', projectCreation => {
		const items = mainMenu(createMockState({ featureFlags: { projectCreation } }));
		expect(items.some(item => item.action === 'new')).toBe(projectCreation);
		expect(items.some((item, index) => item.divider && items[index + 1]?.divider)).toBe(false);
	});

	it('separates built-in and contributed actions only when both exist', () => {
		const contribution = { title: 'Inspect', action: 'inspect' };
		const items = mainMenu(createMockState({ featureFlags: { projectCreation: true } }), [contribution]);
		expect(items).toEqual([{ title: 'New Project', action: 'new', close: true }, { divider: true }, contribution]);
	});
});
