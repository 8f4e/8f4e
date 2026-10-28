import { describe, expect, it } from 'vitest';
import { createMockState } from '~/pureHelpers/testingUtils/testUtils';
import { mainMenu } from './mainMenu';

describe('main menu', () => {
	it('offers disk import', async () => {
		const items = await mainMenu(createMockState());

		expect(items.some(item => item.action === 'importProject')).toBe(true);
	});

	it('hides project-opening actions when project opening is disabled', async () => {
		const state = createMockState({
			featureFlags: {
				projectOpening: false,
			},
		});

		const items = await mainMenu(state);

		expect(items.some(item => item.action === 'importProject')).toBe(false);
		expect(items.some(item => item.action === 'new')).toBe(true);
	});

	it('hides the new-project action when project creation is disabled', async () => {
		const state = createMockState({
			featureFlags: {
				projectCreation: false,
			},
		});

		const items = await mainMenu(state);

		expect(items.some(item => item.action === 'new')).toBe(false);
		expect(items.some(item => item.action === 'importProject')).toBe(true);
	});

	it('does not add adjacent dividers when project actions are disabled', async () => {
		const state = createMockState({
			featureFlags: {
				projectCreation: false,
				projectOpening: false,
			},
		});

		const items = await mainMenu(state);

		expect(items.some((item, index) => item.divider && items[index + 1]?.divider)).toBe(false);
	});
});
