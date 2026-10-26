import { createMockCodeBlock, createMockState } from '@8f4e/editor-state-testing';
import { describe, expect, it } from 'vitest';
import createMenuItemRegistry from './itemRegistry';

describe('menu item registry', () => {
	it('keeps main-menu and block-menu contributions separate', () => {
		const registry = createMenuItemRegistry();
		const state = createMockState();
		const codeBlock = createMockCodeBlock();
		const unregister = registry.registerItem('mainMenu', ({ state }) => ({ title: state.editorMode }));
		registry.registerItem('moduleMenu', ({ codeBlock }) => ({ title: codeBlock.name }));
		expect(registry.getItems('mainMenu', { state })).toEqual([{ title: 'edit' }]);
		expect(registry.getItems('moduleMenu', { state, codeBlock })).toEqual([{ title: codeBlock.name }]);
		state.editorMode = 'view';
		expect(registry.getItems('mainMenu', { state })).toEqual([{ title: 'view' }]);
		unregister();
		expect(registry.getItems('mainMenu', { state })).toEqual([]);
	});

	it('derives items from the current context in registration order and supports removal', () => {
		const registry = createMenuItemRegistry();
		const state = createMockState();
		const codeBlock = createMockCodeBlock({ name: 'first' });
		const unregister = registry.registerItem('moduleMenu', ({ codeBlock }) => ({ title: codeBlock.name }));
		registry.registerItem('moduleMenu', ({ state }) =>
			state.featureFlags.editing ? { title: 'Edit action' } : undefined
		);
		expect(registry.getItems('moduleMenu', { state, codeBlock }).map(item => item.title)).toEqual([
			'first',
			'Edit action',
		]);
		codeBlock.name = 'updated';
		state.featureFlags.editing = false;
		expect(registry.getItems('moduleMenu', { state, codeBlock })).toEqual([{ title: 'updated' }]);
		unregister();
		unregister();
		expect(registry.getItems('moduleMenu', { state, codeBlock })).toEqual([]);
	});
});
